import { clearDatabase, startTestDatabase, stopTestDatabase } from './helpers/setup.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createApp } from '../app.js';
import { createProduct, registerAndLogin } from './helpers/fixtures.js';
import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';

const request = supertest(createApp());
const MISSING_ID = '507f1f77bcf86cd799439011';

describe('Cart API', () => {
  before(startTestDatabase);
  after(stopTestDatabase);
  beforeEach(clearDatabase);

  it('requires authentication', async () => {
    const product = await createProduct();
    const responses = await Promise.all([
      request.get('/cart'),
      request.post(`/cart/${product._id}`),
      request.patch(`/cart/${product._id}`).send({ quantity: 2 }),
      request.delete(`/cart/${product._id}`),
    ]);
    responses.forEach((res) => assert.equal(res.status, 401));
  });

  it('starts empty, adds with quantity 1 and increments instead of duplicating', async () => {
    const { cookie } = await registerAndLogin(request);
    const product = await createProduct({ name: 'Keyboard', price: 2999, stock: 5 });

    const empty = await request.get('/cart').set('Cookie', cookie);
    assert.deepEqual(empty.body, { success: true, cart: [] });

    const first = await request.post(`/cart/${product._id}`).set('Cookie', cookie);
    assert.equal(first.status, 200);
    assert.equal(first.body.cart.length, 1);
    assert.equal(first.body.cart[0].quantity, 1);
    assert.equal(first.body.cart[0].product.name, 'Keyboard');
    assert.equal(first.body.cart[0].product.price, 2999);

    const second = await request.post(`/cart/${product._id}`).set('Cookie', cookie);
    assert.equal(second.body.cart.length, 1);
    assert.equal(second.body.cart[0].quantity, 2);
  });

  it('never lets quantity exceed stock when adding', async () => {
    const { cookie } = await registerAndLogin(request);
    const product = await createProduct({ name: 'Speaker', stock: 2 });

    await request.post(`/cart/${product._id}`).set('Cookie', cookie);
    await request.post(`/cart/${product._id}`).set('Cookie', cookie);
    const third = await request.post(`/cart/${product._id}`).set('Cookie', cookie);
    assert.equal(third.status, 400);
    assert.match(third.body.message, /Only 2 units of Speaker available/);

    const outOfStock = await createProduct({ name: 'Phone', stock: 0 });
    const res = await request.post(`/cart/${outOfStock._id}`).set('Cookie', cookie);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Phone is out of stock');
  });

  it('stays within stock under concurrent adds', async () => {
    const { cookie, customer } = await registerAndLogin(request);
    const product = await createProduct({ stock: 3 });
    await Promise.all(Array.from({ length: 6 }, () => request.post(`/cart/${product._id}`).set('Cookie', cookie)));
    const stored = await Customer.findById(customer._id).lean();
    assert.equal(stored.cart.length, 1);
    assert.equal(stored.cart[0].quantity, 3);
  });

  it('returns 400 for invalid ids and 404 for missing products', async () => {
    const { cookie } = await registerAndLogin(request);
    assert.equal((await request.post('/cart/xyz').set('Cookie', cookie)).status, 400);
    const missing = await request.post(`/cart/${MISSING_ID}`).set('Cookie', cookie);
    assert.equal(missing.status, 404);
  });

  it('updates quantity with validation', async () => {
    const { cookie } = await registerAndLogin(request);
    const product = await createProduct({ stock: 4 });
    await request.post(`/cart/${product._id}`).set('Cookie', cookie);

    const ok = await request.patch(`/cart/${product._id}`).set('Cookie', cookie).send({ quantity: 3 });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.cart[0].quantity, 3);

    for (const quantity of [0, -1, 1.5, '2', null]) {
      const bad = await request.patch(`/cart/${product._id}`).set('Cookie', cookie).send({ quantity });
      assert.equal(bad.status, 400, `quantity ${JSON.stringify(quantity)} should be rejected`);
    }
    const missingBody = await request.patch(`/cart/${product._id}`).set('Cookie', cookie).send({});
    assert.equal(missingBody.status, 400);

    const tooMany = await request.patch(`/cart/${product._id}`).set('Cookie', cookie).send({ quantity: 5 });
    assert.equal(tooMany.status, 400);
    assert.match(tooMany.body.message, /Only 4 units/);
  });

  it('returns 404 when updating a product that is not in the cart or does not exist', async () => {
    const { cookie } = await registerAndLogin(request);
    const product = await createProduct();
    const notInCart = await request.patch(`/cart/${product._id}`).set('Cookie', cookie).send({ quantity: 1 });
    assert.equal(notInCart.status, 404);
    assert.equal(notInCart.body.message, 'Product is not in your cart');

    const missing = await request.patch(`/cart/${MISSING_ID}`).set('Cookie', cookie).send({ quantity: 1 });
    assert.equal(missing.status, 404);
  });

  it('removes an item and returns the updated cart', async () => {
    const { cookie } = await registerAndLogin(request);
    const a = await createProduct();
    const b = await createProduct();
    await request.post(`/cart/${a._id}`).set('Cookie', cookie);
    await request.post(`/cart/${b._id}`).set('Cookie', cookie);

    const res = await request.delete(`/cart/${a._id}`).set('Cookie', cookie);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.cart.map((item) => item.product._id), [String(b._id)]);

    const again = await request.delete(`/cart/${a._id}`).set('Cookie', cookie);
    assert.equal(again.status, 404);
  });

  it('drops cart items whose product was deleted', async () => {
    const { cookie, customer } = await registerAndLogin(request);
    const product = await createProduct();
    await request.post(`/cart/${product._id}`).set('Cookie', cookie);
    await Product.deleteOne({ _id: product._id });

    const res = await request.get('/cart').set('Cookie', cookie);
    assert.deepEqual(res.body.cart, []);
    assert.equal((await Customer.findById(customer._id).lean()).cart.length, 0);
  });

  it('keeps carts separate between customers', async () => {
    const a = await registerAndLogin(request);
    const b = await registerAndLogin(request, { email: 'jane@gmail.com' });
    const product = await createProduct();
    await request.post(`/cart/${product._id}`).set('Cookie', a.cookie);
    const res = await request.get('/cart').set('Cookie', b.cookie);
    assert.deepEqual(res.body.cart, []);
  });
});
