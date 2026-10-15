import { clearDatabase, startTestDatabase, stopTestDatabase } from './helpers/setup.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createApp } from '../app.js';
import { createProduct } from './helpers/fixtures.js';
import Product from '../models/product.model.js';
import { seedProducts } from '../utils/seedProducts.js';
import sampleProducts from '../data/products.js';

const request = supertest(createApp());

describe('Products API', () => {
  before(startTestDatabase);
  after(stopTestDatabase);
  beforeEach(clearDatabase);

  it('lists products publicly with count and categories', async () => {
    await createProduct({ name: 'Blue Headphones', category: 'Electronics' });
    await createProduct({ name: 'Red Sneakers', category: 'Fashion' });

    const res = await request.get('/products');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.count, 2);
    assert.deepEqual(res.body.categories, ['Electronics', 'Fashion']);
    assert.ok(res.body.products.every((p) => p._id && p.name && typeof p.price === 'number'));
  });

  it('filters by search text (case-insensitive) and category', async () => {
    await createProduct({ name: 'Blue Headphones', category: 'Electronics' });
    await createProduct({ name: 'Red Sneakers', category: 'Fashion' });

    const search = await request.get('/products').query({ search: 'HEADPH' });
    assert.deepEqual(search.body.products.map((p) => p.name), ['Blue Headphones']);

    const category = await request.get('/products').query({ category: 'Fashion' });
    assert.deepEqual(category.body.products.map((p) => p.name), ['Red Sneakers']);
  });

  it('treats regex characters in search as literal text', async () => {
    await createProduct({ name: 'Plain Product' });
    const res = await request.get('/products').query({ search: '.*' });
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 0);
  });

  it('returns a single product, 404 when missing and 400 for an invalid id', async () => {
    const product = await createProduct();

    const found = await request.get(`/products/${product._id}`);
    assert.equal(found.status, 200);
    assert.equal(found.body.product.name, product.name);

    const missing = await request.get('/products/507f1f77bcf86cd799439011');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, 'Product not found');

    const invalid = await request.get('/products/not-an-id');
    assert.equal(invalid.status, 400);
  });

  it('seeds sample products idempotently', async () => {
    const first = await seedProducts();
    assert.equal(first.inserted, sampleProducts.length);
    const second = await seedProducts();
    assert.equal(second.inserted, 0);
    assert.equal(await Product.countDocuments(), sampleProducts.length);
  });
});
