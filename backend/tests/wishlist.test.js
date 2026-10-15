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

describe('Wishlist API', () => {
  before(startTestDatabase);
  after(stopTestDatabase);
  beforeEach(clearDatabase);

  it('requires authentication on every route', async () => {
    const product = await createProduct();
    const responses = await Promise.all([
      request.get('/wishlist'),
      request.post(`/wishlist/${product._id}`),
      request.delete(`/wishlist/${product._id}`),
      request.patch(`/wishlist/${product._id}/toggle`),
    ]);
    responses.forEach((res) => assert.equal(res.status, 401));
  });

  it('adds a product, then returns the populated wishlist', async () => {
    const { cookie } = await registerAndLogin(request);
    const product = await createProduct({ name: 'Wireless Mouse', price: 1499 });

    const add = await request.post(`/wishlist/${product._id}`).set('Cookie', cookie);
    assert.equal(add.status, 201);
    assert.equal(add.body.message, 'Product added to wishlist');

    const list = await request.get('/wishlist').set('Cookie', cookie);
    assert.equal(list.status, 200);
    assert.equal(list.body.success, true);
    assert.equal(list.body.count, 1);
    assert.equal(list.body.wishlist[0].name, 'Wireless Mouse');
    assert.equal(list.body.wishlist[0].price, 1499);
    assert.ok('image' in list.body.wishlist[0] && 'stock' in list.body.wishlist[0]);
  });

  it('rejects duplicates with 409 and stores the id only once', async () => {
    const { cookie, customer } = await registerAndLogin(request);
    const product = await createProduct();

    await request.post(`/wishlist/${product._id}`).set('Cookie', cookie);
    const again = await request.post(`/wishlist/${product._id}`).set('Cookie', cookie);
    assert.equal(again.status, 409);
    assert.equal(again.body.message, 'Product is already in your wishlist');

    const stored = await Customer.findById(customer._id).lean();
    assert.equal(stored.wishlist.length, 1);
  });

  it('never stores duplicates under concurrent adds', async () => {
    const { cookie, customer } = await registerAndLogin(request);
    const product = await createProduct();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => request.post(`/wishlist/${product._id}`).set('Cookie', cookie)),
    );
    assert.equal(results.filter((res) => res.status === 201).length, 1);
    const stored = await Customer.findById(customer._id).lean();
    assert.equal(stored.wishlist.length, 1);
  });

  it('returns 400 for an invalid id and 404 for a missing product', async () => {
    const { cookie } = await registerAndLogin(request);
    const invalid = await request.post('/wishlist/abc').set('Cookie', cookie);
    assert.equal(invalid.status, 400);
    const missing = await request.post(`/wishlist/${MISSING_ID}`).set('Cookie', cookie);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, 'Product not found');
  });

  it('removes a product and returns 404 if it is not in the wishlist', async () => {
    const { cookie } = await registerAndLogin(request);
    const product = await createProduct();
    await request.post(`/wishlist/${product._id}`).set('Cookie', cookie);

    const removed = await request.delete(`/wishlist/${product._id}`).set('Cookie', cookie);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.message, 'Product removed from wishlist');

    const again = await request.delete(`/wishlist/${product._id}`).set('Cookie', cookie);
    assert.equal(again.status, 404);
    assert.equal(again.body.message, 'Product is not in your wishlist');
  });

  it('toggles a product in and out', async () => {
    const { cookie } = await registerAndLogin(request);
    const product = await createProduct();

    const on = await request.patch(`/wishlist/${product._id}/toggle`).set('Cookie', cookie);
    assert.equal(on.status, 200);
    assert.equal(on.body.saved, true);

    const off = await request.patch(`/wishlist/${product._id}/toggle`).set('Cookie', cookie);
    assert.equal(off.body.saved, false);

    const missing = await request.patch(`/wishlist/${MISSING_ID}/toggle`).set('Cookie', cookie);
    assert.equal(missing.status, 404);
  });

  it('keeps wishlists separate between customers', async () => {
    const a = await registerAndLogin(request);
    const b = await registerAndLogin(request, { email: 'jane@gmail.com' });
    const product = await createProduct();
    await request.post(`/wishlist/${product._id}`).set('Cookie', a.cookie);

    const listB = await request.get('/wishlist').set('Cookie', b.cookie);
    assert.equal(listB.body.count, 0);
  });

  it('drops products that were deleted from the catalogue', async () => {
    const { cookie, customer } = await registerAndLogin(request);
    const keep = await createProduct();
    const gone = await createProduct();
    await request.post(`/wishlist/${keep._id}`).set('Cookie', cookie);
    await request.post(`/wishlist/${gone._id}`).set('Cookie', cookie);
    await Product.deleteOne({ _id: gone._id });

    const list = await request.get('/wishlist').set('Cookie', cookie);
    assert.equal(list.body.count, 1);
    const stored = await Customer.findById(customer._id).lean();
    assert.deepEqual(stored.wishlist.map(String), [String(keep._id)]);
  });

  it('does not expose a route that accepts a user id', async () => {
    const { cookie, customer } = await registerAndLogin(request);
    const res = await request.get(`/wishlist/${customer._id}`).set('Cookie', cookie);
    assert.equal(res.status, 404);
  });
});
