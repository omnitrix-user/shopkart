import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';
import HttpError from '../utils/httpError.js';
import { requireObjectId } from '../utils/objectId.js';

const CART_PRODUCT_FIELDS = 'name price category image stock';

const stockMessage = (product) =>
  product.stock === 0
    ? `${product.name} is out of stock`
    : `Only ${product.stock} unit${product.stock === 1 ? '' : 's'} of ${product.name} available`;

/**
 * Loads the customer's cart with live product data (price, stock, image).
 * Items whose product has been deleted are removed from the stored cart.
 */
export async function loadCart(customerId) {
  const customer = await Customer.findById(customerId).select('cart').lean();
  if (!customer) {
    throw new HttpError(401, 'Your session is invalid or has expired. Please log in again.');
  }

  const storedIds = customer.cart.map((item) => item.product);
  await Customer.populate(customer, { path: 'cart.product', select: CART_PRODUCT_FIELDS });

  const cart = customer.cart.filter((item) => item.product);
  if (cart.length < storedIds.length) {
    const liveIds = new Set(cart.map((item) => String(item.product._id)));
    const deletedIds = storedIds.filter((id) => !liveIds.has(String(id)));
    await Customer.updateOne({ _id: customerId }, { $pull: { cart: { product: { $in: deletedIds } } } });
  }

  return cart.map(({ product, quantity }) => ({ product, quantity }));
}

const sendCart = async (req, res, message) => {
  const cart = await loadCart(req.user._id);
  res.status(200).json({ success: true, message, cart });
};

/** GET /cart */
export async function getCart(req, res) {
  const cart = await loadCart(req.user._id);
  res.status(200).json({ success: true, cart });
}

/**
 * POST /cart/:productId — adds one unit. A product already in the cart has its quantity
 * increased instead of creating a second row. Quantity can never exceed current stock.
 */
export async function addToCart(req, res) {
  const productId = requireObjectId(req.params.productId, 'product ID');
  const product = await Product.findById(productId).select('name stock').lean();
  if (!product) {
    throw new HttpError(404, 'Product not found');
  }

  const customerId = req.user._id;

  // Both branches are single atomic updates; the loop only repeats if a concurrent
  // request inserted the same product between the two attempts.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const incremented = await Customer.updateOne(
      { _id: customerId, cart: { $elemMatch: { product: productId, quantity: { $lt: product.stock } } } },
      { $inc: { 'cart.$.quantity': 1 } },
    );
    if (incremented.modifiedCount > 0) {
      return sendCart(req, res, 'Cart updated');
    }

    if (await Customer.exists({ _id: customerId, 'cart.product': productId })) {
      throw new HttpError(400, `${stockMessage(product)}. You already have the maximum in your cart.`);
    }

    if (product.stock < 1) {
      throw new HttpError(400, stockMessage(product));
    }

    const inserted = await Customer.updateOne(
      { _id: customerId, 'cart.product': { $ne: productId } },
      { $push: { cart: { product: productId, quantity: 1 } } },
    );
    if (inserted.modifiedCount > 0) {
      return sendCart(req, res, 'Cart updated');
    }
  }

  throw new HttpError(409, 'Your cart changed while updating. Please try again.');
}

/** PATCH /cart/:productId  body: { quantity } */
export async function updateCartQuantity(req, res) {
  const productId = requireObjectId(req.params.productId, 'product ID');
  const quantity = req.body?.quantity;

  if (typeof quantity !== 'number' || !Number.isInteger(quantity)) {
    throw new HttpError(400, 'Quantity must be a whole number', { quantity: 'Quantity must be a whole number' });
  }
  if (quantity < 1) {
    throw new HttpError(400, 'Quantity must be at least 1', { quantity: 'Quantity must be at least 1' });
  }

  const product = await Product.findById(productId).select('name stock').lean();
  if (!product) {
    throw new HttpError(404, 'Product not found');
  }
  if (quantity > product.stock) {
    throw new HttpError(400, stockMessage(product), { quantity: stockMessage(product) });
  }

  const result = await Customer.updateOne(
    { _id: req.user._id, 'cart.product': productId },
    { $set: { 'cart.$.quantity': quantity } },
  );
  if (result.matchedCount === 0) {
    throw new HttpError(404, 'Product is not in your cart');
  }

  return sendCart(req, res, 'Quantity updated');
}

/** DELETE /cart/:productId */
export async function removeFromCart(req, res) {
  const productId = requireObjectId(req.params.productId, 'product ID');

  const result = await Customer.updateOne(
    { _id: req.user._id, 'cart.product': productId },
    { $pull: { cart: { product: productId } } },
  );
  if (result.modifiedCount === 0) {
    throw new HttpError(404, 'Product is not in your cart');
  }

  return sendCart(req, res, 'Product removed from cart');
}
