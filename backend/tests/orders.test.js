import { clearDatabase, startTestDatabase, stopTestDatabase } from './helpers/setup.js';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import supertest from 'supertest';
import { createApp } from '../app.js';
import { createProduct, registerAndLogin } from './helpers/fixtures.js';
import { getRazorpayClient } from '../config/razorpay.js';
import Customer from '../models/customer.model.js';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';

const request = supertest(createApp());

const shippingAddress = () => ({
  fullName: 'John Doe',
  phone: '9876543210',
  addressLine1: '12 MG Road, Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560038',
});

const sign = (orderId, paymentId, secret = process.env.RAZORPAY_KEY_SECRET) =>
  crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

let razorpayCounter = 0;
let createCalls;

function mockRazorpay(impl) {
  createCalls = [];
  mock.method(
    getRazorpayClient().orders,
    'create',
    impl ??
      (async (options) => {
        createCalls.push(options);
        razorpayCounter += 1;
        return { id: `order_TEST${razorpayCounter}`, amount: options.amount, currency: options.currency };
      }),
  );
}

async function customerWithCart(items, overrides) {
  const session = await registerAndLogin(request, overrides);
  for (const { product, quantity } of items) {
    for (let i = 0; i < quantity; i += 1) {
      await request.post(`/cart/${product._id}`).set('Cookie', session.cookie);
    }
  }
  return session;
}

const startCheckout = (cookie, body = { shippingAddress: shippingAddress() }) =>
  request.post('/orders/create-payment-order').set('Cookie', cookie).send(body);

async function payFor(cookie, checkout, paymentId = 'pay_TEST123') {
  return request
    .post('/orders/verify-payment')
    .set('Cookie', cookie)
    .send({
      shopKartOrderId: checkout.body.shopKartOrderId,
      razorpay_order_id: checkout.body.razorpayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(checkout.body.razorpayOrderId, paymentId),
    });
}

describe('Orders & Razorpay checkout', () => {
  before(startTestDatabase);
  after(stopTestDatabase);
  beforeEach(async () => {
    await clearDatabase();
    mockRazorpay();
  });
  afterEach(() => mock.restoreAll());

  describe('POST /orders/create-payment-order', () => {
    it('requires authentication', async () => {
      const res = await request.post('/orders/create-payment-order').send({ shippingAddress: shippingAddress() });
      assert.equal(res.status, 401);
    });

    it('creates a pending order priced from the database and a Razorpay order in paise', async () => {
      const headphones = await createProduct({ name: 'Headphones', price: 4999, stock: 5 });
      const mug = await createProduct({ name: 'Mug', price: 449, stock: 5 });
      const { cookie, customer } = await customerWithCart([
        { product: headphones, quantity: 2 },
        { product: mug, quantity: 1 },
      ]);

      const res = await startCheckout(cookie);
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.amount, (4999 * 2 + 449) * 100);
      assert.equal(res.body.currency, 'INR');
      assert.equal(res.body.key, process.env.RAZORPAY_KEY_ID);
      assert.match(res.body.razorpayOrderId, /^order_TEST/);
      assert.deepEqual(Object.keys(res.body).sort(), [
        'amount', 'currency', 'key', 'razorpayOrderId', 'shopKartOrderId', 'success',
      ]);
      assert.doesNotMatch(JSON.stringify(res.body), new RegExp(process.env.RAZORPAY_KEY_SECRET));

      assert.equal(createCalls.length, 1);
      assert.deepEqual(
        { amount: createCalls[0].amount, currency: createCalls[0].currency, receipt: createCalls[0].receipt },
        { amount: 1044700, currency: 'INR', receipt: res.body.shopKartOrderId },
      );

      const order = await Order.findById(res.body.shopKartOrderId).lean();
      assert.equal(String(order.user), customer._id);
      assert.equal(order.totalAmount, 10447);
      assert.equal(order.paymentStatus, 'PENDING');
      assert.equal(order.status, 'PENDING_PAYMENT');
      assert.equal(order.razorpayOrderId, res.body.razorpayOrderId);
      assert.deepEqual(
        order.items.map(({ name, price, quantity, image }) => ({ name, price, quantity, image })),
        [
          { name: 'Headphones', price: 4999, quantity: 2, image: headphones.image },
          { name: 'Mug', price: 449, quantity: 1, image: mug.image },
        ],
      );

      // The cart is untouched until payment is verified.
      assert.equal((await Customer.findById(customer._id).lean()).cart.length, 2);
    });

    it('ignores any totalAmount or prices sent by the client', async () => {
      const product = await createProduct({ price: 2500 });
      const { cookie } = await customerWithCart([{ product, quantity: 1 }]);

      const res = await startCheckout(cookie, {
        shippingAddress: shippingAddress(),
        totalAmount: 1,
        amount: 100,
        items: [{ product: String(product._id), price: 1, quantity: 1 }],
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.amount, 250000);
      assert.equal((await Order.findById(res.body.shopKartOrderId)).totalAmount, 2500);
    });

    it('uses the current product price, not the price when it was added to the cart', async () => {
      const product = await createProduct({ price: 1000 });
      const { cookie } = await customerWithCart([{ product, quantity: 1 }]);
      await Product.updateOne({ _id: product._id }, { price: 1200 });

      const res = await startCheckout(cookie);
      assert.equal(res.body.amount, 120000);
    });

    it('rejects an empty cart', async () => {
      const { cookie } = await registerAndLogin(request);
      const res = await startCheckout(cookie);
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Your cart is empty');
      assert.equal(createCalls.length, 0);
    });

    it('rejects insufficient stock by product name', async () => {
      const product = await createProduct({ name: 'Instant Camera', stock: 3 });
      const { cookie } = await customerWithCart([{ product, quantity: 3 }]);
      await Product.updateOne({ _id: product._id }, { stock: 2 });

      const res = await startCheckout(cookie);
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Insufficient stock for Instant Camera');
      assert.equal(await Order.countDocuments(), 0);
      assert.equal(createCalls.length, 0);
    });

    it('validates the shipping address before calling Razorpay', async () => {
      const product = await createProduct();
      const { cookie } = await customerWithCart([{ product, quantity: 1 }]);

      const cases = [
        [{ ...shippingAddress(), fullName: '   ' }, 'fullName'],
        [{ ...shippingAddress(), phone: '12345' }, 'phone'],
        [{ ...shippingAddress(), phone: '5876543210' }, 'phone'],
        [{ ...shippingAddress(), pincode: '56003' }, 'pincode'],
        [{ ...shippingAddress(), pincode: '056003' }, 'pincode'],
        [{ ...shippingAddress(), city: { $ne: '' } }, 'city'],
      ];
      for (const [address, field] of cases) {
        const res = await startCheckout(cookie, { shippingAddress: address });
        assert.equal(res.status, 400, `expected ${field} to be rejected`);
        assert.ok(res.body.errors[field], `expected an error for ${field}`);
      }
      assert.equal((await startCheckout(cookie, {})).status, 400);
      assert.equal(createCalls.length, 0);
      assert.equal(await Order.countDocuments(), 0);
    });

    it('accepts +91 / spaced phone numbers and stores them normalised', async () => {
      const product = await createProduct();
      const { cookie } = await customerWithCart([{ product, quantity: 1 }]);
      const res = await startCheckout(cookie, { shippingAddress: { ...shippingAddress(), phone: '+91 98765 43210' } });
      assert.equal(res.status, 201);
      const order = await Order.findById(res.body.shopKartOrderId).lean();
      assert.equal(order.shippingAddress.phone, '9876543210');
    });

    it('returns 502 and discards the pending order if Razorpay fails', async () => {
      mock.restoreAll();
      mockRazorpay(async () => {
        throw { statusCode: 401, error: { description: 'Authentication failed' } };
      });
      const product = await createProduct();
      const { cookie } = await customerWithCart([{ product, quantity: 1 }]);

      const res = await startCheckout(cookie);
      assert.equal(res.status, 502);
      assert.equal(await Order.countDocuments(), 0);
    });

    it('returns 503 when Razorpay keys are not configured', async () => {
      const product = await createProduct();
      const { cookie } = await customerWithCart([{ product, quantity: 1 }]);
      const saved = process.env.RAZORPAY_KEY_SECRET;
      delete process.env.RAZORPAY_KEY_SECRET;
      try {
        const res = await startCheckout(cookie);
        assert.equal(res.status, 503);
      } finally {
        process.env.RAZORPAY_KEY_SECRET = saved;
      }
    });
  });

  describe('POST /orders/verify-payment', () => {
    async function pendingCheckout() {
      const product = await createProduct({ name: 'Watch', price: 5999, stock: 4 });
      const session = await customerWithCart([{ product, quantity: 2 }]);
      const checkout = await startCheckout(session.cookie);
      return { ...session, product, checkout };
    }

    it('marks the order PAID + PLACED, stores the payment id, clears the cart and reduces stock', async () => {
      const { cookie, customer, product, checkout } = await pendingCheckout();

      const res = await payFor(cookie, checkout, 'pay_ABC');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.order.paymentStatus, 'PAID');
      assert.equal(res.body.order.status, 'PLACED');
      assert.equal(res.body.order.razorpayPaymentId, 'pay_ABC');

      assert.equal((await Customer.findById(customer._id).lean()).cart.length, 0);
      assert.equal((await Product.findById(product._id).lean()).stock, 2);
    });

    it('rejects an invalid signature without marking paid or clearing the cart', async () => {
      const { cookie, customer, checkout } = await pendingCheckout();

      const res = await request
        .post('/orders/verify-payment')
        .set('Cookie', cookie)
        .send({
          shopKartOrderId: checkout.body.shopKartOrderId,
          razorpay_order_id: checkout.body.razorpayOrderId,
          razorpay_payment_id: 'pay_FAKE',
          razorpay_signature: sign(checkout.body.razorpayOrderId, 'pay_FAKE', 'wrong-secret'),
        });
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid payment signature');

      const order = await Order.findById(checkout.body.shopKartOrderId).lean();
      assert.equal(order.paymentStatus, 'PENDING');
      assert.equal(order.razorpayPaymentId, undefined);
      assert.equal((await Customer.findById(customer._id).lean()).cart.length, 1);
    });

    it('ignores a client-side paymentSuccess flag', async () => {
      const { cookie, checkout } = await pendingCheckout();
      const res = await request
        .post('/orders/verify-payment')
        .set('Cookie', cookie)
        .send({
          shopKartOrderId: checkout.body.shopKartOrderId,
          razorpay_order_id: checkout.body.razorpayOrderId,
          razorpay_payment_id: 'pay_X',
          razorpay_signature: 'not-a-real-signature',
          paymentSuccess: true,
        });
      assert.equal(res.status, 400);
      assert.equal((await Order.findById(checkout.body.shopKartOrderId)).paymentStatus, 'PENDING');
    });

    it('verifies against the stored Razorpay order id, not a different one from the browser', async () => {
      const { cookie, checkout } = await pendingCheckout();
      const otherRazorpayOrder = 'order_SOMEONE_ELSE';
      const res = await request
        .post('/orders/verify-payment')
        .set('Cookie', cookie)
        .send({
          shopKartOrderId: checkout.body.shopKartOrderId,
          razorpay_order_id: otherRazorpayOrder,
          razorpay_payment_id: 'pay_Y',
          razorpay_signature: sign(otherRazorpayOrder, 'pay_Y'),
        });
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid payment signature');
    });

    it("cannot verify another customer's order", async () => {
      const { checkout } = await pendingCheckout();
      const intruder = await registerAndLogin(request, { email: 'intruder@gmail.com' });
      const res = await payFor(intruder.cookie, checkout);
      assert.equal(res.status, 404);
      assert.equal((await Order.findById(checkout.body.shopKartOrderId)).paymentStatus, 'PENDING');
    });

    it('is idempotent for the same payment and rejects a second, different payment', async () => {
      const { cookie, product, checkout } = await pendingCheckout();
      assert.equal((await payFor(cookie, checkout, 'pay_ONE')).status, 200);

      const repeat = await payFor(cookie, checkout, 'pay_ONE');
      assert.equal(repeat.status, 200);
      assert.equal(repeat.body.order.razorpayPaymentId, 'pay_ONE');
      assert.equal((await Product.findById(product._id).lean()).stock, 2, 'stock must only drop once');

      const different = await payFor(cookie, checkout, 'pay_TWO');
      assert.equal(different.status, 409);
    });

    it('rejects incomplete payloads', async () => {
      const { cookie, checkout } = await pendingCheckout();
      const missing = await request
        .post('/orders/verify-payment')
        .set('Cookie', cookie)
        .send({ shopKartOrderId: checkout.body.shopKartOrderId });
      assert.equal(missing.status, 400);

      const badId = await request.post('/orders/verify-payment').set('Cookie', cookie).send({ shopKartOrderId: 'x' });
      assert.equal(badId.status, 400);
    });

    it('records a failed payment without clearing the cart, and still allows a later successful retry', async () => {
      const { cookie, customer, checkout } = await pendingCheckout();

      const failed = await request
        .post(`/orders/${checkout.body.shopKartOrderId}/payment-failed`)
        .set('Cookie', cookie);
      assert.equal(failed.status, 200);
      assert.equal(failed.body.order.paymentStatus, 'FAILED');
      assert.equal((await Customer.findById(customer._id).lean()).cart.length, 1);

      const retry = await payFor(cookie, checkout, 'pay_RETRY');
      assert.equal(retry.status, 200);
      assert.equal(retry.body.order.paymentStatus, 'PAID');
    });
  });

  describe('GET /orders and GET /orders/:id', () => {
    it('lists only my paid orders, newest first; includeUnpaid shows pending ones', async () => {
      const product = await createProduct({ stock: 10 });
      const { cookie } = await customerWithCart([{ product, quantity: 1 }]);

      const first = await startCheckout(cookie);
      await payFor(cookie, first, 'pay_1');
      await request.post(`/cart/${product._id}`).set('Cookie', cookie);
      const second = await startCheckout(cookie);
      await payFor(cookie, second, 'pay_2');
      await request.post(`/cart/${product._id}`).set('Cookie', cookie);
      await startCheckout(cookie); // left unpaid

      const other = await customerWithCart([{ product, quantity: 1 }], { email: 'other@gmail.com' });
      await payFor(other.cookie, await startCheckout(other.cookie), 'pay_other');

      const res = await request.get('/orders').set('Cookie', cookie);
      assert.equal(res.status, 200);
      assert.equal(res.body.count, 2);
      assert.deepEqual(
        res.body.orders.map((o) => o._id),
        [second.body.shopKartOrderId, first.body.shopKartOrderId],
      );

      const all = await request.get('/orders').query({ includeUnpaid: 'true' }).set('Cookie', cookie);
      assert.equal(all.body.count, 3);
    });

    it('returns order details only to the owner', async () => {
      const product = await createProduct();
      const owner = await customerWithCart([{ product, quantity: 1 }]);
      const checkout = await startCheckout(owner.cookie);
      await payFor(owner.cookie, checkout);
      const id = checkout.body.shopKartOrderId;

      const mine = await request.get(`/orders/${id}`).set('Cookie', owner.cookie);
      assert.equal(mine.status, 200);
      assert.equal(mine.body.order.shippingAddress.city, 'Bengaluru');

      const intruder = await registerAndLogin(request, { email: 'intruder@gmail.com' });
      const theirs = await request.get(`/orders/${id}`).set('Cookie', intruder.cookie);
      assert.equal(theirs.status, 404);

      assert.equal((await request.get('/orders/nope').set('Cookie', owner.cookie)).status, 400);
      assert.equal((await request.get(`/orders/${id}`)).status, 401);
    });
  });

  describe('PATCH /orders/:id/status (demo)', () => {
    it('moves a paid order forward only', async () => {
      const product = await createProduct();
      const { cookie } = await customerWithCart([{ product, quantity: 1 }]);
      const checkout = await startCheckout(cookie);
      const id = checkout.body.shopKartOrderId;

      const unpaid = await request.patch(`/orders/${id}/status`).set('Cookie', cookie).send({ status: 'CONFIRMED' });
      assert.equal(unpaid.status, 400);

      await payFor(cookie, checkout);
      for (const status of ['CONFIRMED', 'SHIPPED', 'DELIVERED']) {
        const res = await request.patch(`/orders/${id}/status`).set('Cookie', cookie).send({ status });
        assert.equal(res.status, 200);
        assert.equal(res.body.order.status, status);
      }
      const order = await Order.findById(id).lean();
      assert.deepEqual(
        order.statusHistory.map((event) => event.status),
        ['PENDING_PAYMENT', 'PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'],
      );

      const backwards = await request.patch(`/orders/${id}/status`).set('Cookie', cookie).send({ status: 'SHIPPED' });
      assert.equal(backwards.status, 400);
      const invalid = await request.patch(`/orders/${id}/status`).set('Cookie', cookie).send({ status: 'PAID' });
      assert.equal(invalid.status, 400);
    });

    it('is disabled in production unless explicitly enabled', async () => {
      const product = await createProduct();
      const { cookie } = await customerWithCart([{ product, quantity: 1 }]);
      const checkout = await startCheckout(cookie);
      await payFor(cookie, checkout);

      process.env.NODE_ENV = 'production';
      try {
        const res = await request
          .patch(`/orders/${checkout.body.shopKartOrderId}/status`)
          .set('Cookie', cookie)
          .send({ status: 'CONFIRMED' });
        assert.equal(res.status, 404);
      } finally {
        process.env.NODE_ENV = 'test';
      }
    });
  });
});
