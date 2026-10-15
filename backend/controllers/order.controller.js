import crypto from 'node:crypto';
import Customer from '../models/customer.model.js';
import Order, { ORDER_STATUSES } from '../models/order.model.js';
import Product from '../models/product.model.js';
import HttpError from '../utils/httpError.js';
import { isObjectIdString, requireObjectId } from '../utils/objectId.js';
import { validateShippingAddress } from '../utils/shippingAddress.js';
import { firstErrorMessage } from '../utils/validators.js';
import {
  getRazorpayClient,
  getRazorpayKeyId,
  getRazorpayKeySecret,
  isRazorpayConfigured,
} from '../config/razorpay.js';
import { isProduction, isTest } from '../config/env.js';

const CURRENCY = 'INR';
const INVALID_SIGNATURE = 'Invalid payment signature';

function requirePaymentsConfigured() {
  if (!isRazorpayConfigured()) {
    throw new HttpError(503, 'Online payments are not configured yet. Please try again later.');
  }
}

/**
 * Re-reads the cart and current product data, and returns order line items priced
 * from the database. Any amount sent by the browser is ignored.
 */
async function buildOrderItemsFromCart(customerId) {
  const customer = await Customer.findById(customerId).select('cart').lean();
  const cart = customer?.cart ?? [];
  if (cart.length === 0) {
    throw new HttpError(400, 'Your cart is empty');
  }

  const products = await Product.find({ _id: { $in: cart.map((item) => item.product) } })
    .select('name price image stock')
    .lean();
  const productsById = new Map(products.map((product) => [String(product._id), product]));

  const items = cart.map(({ product: productId, quantity }) => {
    const product = productsById.get(String(productId));
    if (!product) {
      throw new HttpError(400, 'A product in your cart is no longer available. Please review your cart.');
    }
    if (quantity > product.stock) {
      throw new HttpError(400, `Insufficient stock for ${product.name}`);
    }
    return {
      product: product._id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.image,
    };
  });

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { items, totalAmount };
}

/** POST /orders/create-payment-order  body: { shippingAddress } */
export async function createPaymentOrder(req, res) {
  const { errors, data: shippingAddress } = validateShippingAddress(req.body?.shippingAddress);
  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, firstErrorMessage(errors), errors);
  }

  const { items, totalAmount } = await buildOrderItemsFromCart(req.user._id);
  requirePaymentsConfigured();

  const order = await Order.create({
    user: req.user._id,
    items,
    shippingAddress,
    totalAmount,
    currency: CURRENCY,
  });

  let razorpayOrder;
  try {
    razorpayOrder = await getRazorpayClient().orders.create({
      amount: Math.round(totalAmount * 100),
      currency: CURRENCY,
      receipt: String(order._id),
      notes: { shopKartOrderId: String(order._id) },
    });
  } catch (error) {
    await Order.deleteOne({ _id: order._id });
    if (!isTest()) {
      // The SDK rejects with a plain object; log only Razorpay's description, never keys.
      console.error(`[razorpay] Order creation failed: ${error?.error?.description || error?.message || 'unknown error'}`);
    }
    throw new HttpError(502, 'Could not start the payment with Razorpay. Please try again.');
  }

  order.razorpayOrderId = razorpayOrder.id;
  await order.save();

  res.status(201).json({
    success: true,
    shopKartOrderId: order._id,
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    key: getRazorpayKeyId(),
  });
}

const readString = (value) => (typeof value === 'string' ? value.trim() : '');

function isValidSignature(razorpayOrderId, razorpayPaymentId, signature) {
  const expected = crypto
    .createHmac('sha256', getRazorpayKeySecret())
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(signature, 'utf8');
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

async function decrementStock(items) {
  for (const { product, quantity } of items) {
    const result = await Product.updateOne({ _id: product, stock: { $gte: quantity } }, { $inc: { stock: -quantity } });
    if (result.matchedCount === 0) {
      // Stock is not reserved during checkout, so two buyers can pay for the last unit.
      // The payment is already captured; never let stock go negative.
      await Product.updateOne({ _id: product }, [{ $set: { stock: { $max: [0, { $subtract: ['$stock', quantity] }] } } }]);
    }
  }
}

/**
 * POST /orders/verify-payment
 * body: { shopKartOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
export async function verifyPayment(req, res) {
  const shopKartOrderId = readString(req.body?.shopKartOrderId);
  const razorpayOrderId = readString(req.body?.razorpay_order_id);
  const razorpayPaymentId = readString(req.body?.razorpay_payment_id);
  const signature = readString(req.body?.razorpay_signature);

  if (!isObjectIdString(shopKartOrderId)) {
    throw new HttpError(400, 'Invalid order ID');
  }
  if (!razorpayOrderId || !razorpayPaymentId || !signature) {
    throw new HttpError(400, 'Payment details are incomplete');
  }

  const order = await Order.findOne({ _id: shopKartOrderId, user: req.user._id }).lean();
  if (!order) {
    throw new HttpError(404, 'Order not found');
  }
  requirePaymentsConfigured();

  // The HMAC is computed over the Razorpay order id stored in our database, not the one
  // the browser sent, so a valid signature for a different order cannot be replayed here.
  if (
    !order.razorpayOrderId ||
    razorpayOrderId !== order.razorpayOrderId ||
    !isValidSignature(order.razorpayOrderId, razorpayPaymentId, signature)
  ) {
    throw new HttpError(400, INVALID_SIGNATURE);
  }

  const paidOrder = await Order.findOneAndUpdate(
    { _id: order._id, user: req.user._id, paymentStatus: { $ne: 'PAID' } },
    {
      $set: { paymentStatus: 'PAID', status: 'PLACED', razorpayPaymentId, paidAt: new Date() },
      $push: { statusHistory: { status: 'PLACED' } },
    },
    { returnDocument: 'after', lean: true },
  );

  if (!paidOrder) {
    // Already paid (e.g. the success handler fired twice). Repeat the same answer, but
    // never accept a second, different payment for the same order.
    const existing = await Order.findById(order._id).lean();
    if (existing.razorpayPaymentId === razorpayPaymentId) {
      return res.status(200).json({ success: true, message: 'Payment already verified', order: existing });
    }
    throw new HttpError(409, 'This order has already been paid');
  }

  await decrementStock(paidOrder.items);
  await Customer.updateOne(
    { _id: req.user._id },
    { $pull: { cart: { product: { $in: paidOrder.items.map((item) => item.product) } } } },
  );

  res.status(200).json({ success: true, message: 'Payment verified. Your order has been placed.', order: paidOrder });
}

/** POST /orders/:id/payment-failed — records a failed/cancelled attempt. Cart is untouched. */
export async function markPaymentFailed(req, res) {
  const id = requireObjectId(req.params.id, 'order ID');
  const order = await Order.findOneAndUpdate(
    { _id: id, user: req.user._id, paymentStatus: 'PENDING' },
    { $set: { paymentStatus: 'FAILED' } },
    { returnDocument: 'after', lean: true },
  );
  if (order) {
    return res.status(200).json({ success: true, order });
  }

  const existing = await Order.findOne({ _id: id, user: req.user._id }).lean();
  if (!existing) {
    throw new HttpError(404, 'Order not found');
  }
  res.status(200).json({ success: true, order: existing });
}

/** GET /orders — the logged-in customer's placed orders, newest first. */
export async function getMyOrders(req, res) {
  const filter = { user: req.user._id };
  if (req.query.includeUnpaid !== 'true') {
    filter.paymentStatus = 'PAID';
  }
  const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
  res.status(200).json({ success: true, count: orders.length, orders });
}

/** GET /orders/:id — 404 for both missing orders and other customers' orders. */
export async function getOrderById(req, res) {
  const id = requireObjectId(req.params.id, 'order ID');
  const order = await Order.findOne({ _id: id, user: req.user._id }).lean();
  if (!order) {
    throw new HttpError(404, 'Order not found');
  }
  res.status(200).json({ success: true, order });
}

export const isOrderStatusDemoEnabled = () =>
  !isProduction() || process.env.ENABLE_ORDER_STATUS_DEMO === 'true';

const FULFILMENT_STATUSES = ORDER_STATUSES.slice(ORDER_STATUSES.indexOf('PLACED'));

/**
 * PATCH /orders/:id/status  body: { status }
 * Demo-only endpoint to move a paid order forward (PLACED → CONFIRMED → SHIPPED → DELIVERED).
 * Disabled in production unless ENABLE_ORDER_STATUS_DEMO=true.
 */
export async function updateOrderStatus(req, res) {
  if (!isOrderStatusDemoEnabled()) {
    throw new HttpError(404, `Route not found: ${req.method} ${req.path}`);
  }

  const id = requireObjectId(req.params.id, 'order ID');
  const status = req.body?.status;
  if (typeof status !== 'string' || !FULFILMENT_STATUSES.includes(status) || status === 'PLACED') {
    throw new HttpError(400, `Status must be one of: ${FULFILMENT_STATUSES.slice(1).join(', ')}`);
  }

  const earlierStatuses = FULFILMENT_STATUSES.slice(0, FULFILMENT_STATUSES.indexOf(status));
  const order = await Order.findOneAndUpdate(
    { _id: id, user: req.user._id, paymentStatus: 'PAID', status: { $in: earlierStatuses } },
    { $set: { status }, $push: { statusHistory: { status } } },
    { returnDocument: 'after', lean: true },
  );

  if (!order) {
    const existing = await Order.findOne({ _id: id, user: req.user._id }).lean();
    if (!existing) {
      throw new HttpError(404, 'Order not found');
    }
    if (existing.paymentStatus !== 'PAID') {
      throw new HttpError(400, 'Only paid orders can be progressed');
    }
    throw new HttpError(400, `Order is already ${existing.status}; status can only move forward`);
  }

  res.status(200).json({ success: true, order });
}
