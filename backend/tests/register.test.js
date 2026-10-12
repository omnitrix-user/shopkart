import { clearDatabase, startTestDatabase, stopTestDatabase } from './helpers/setup.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../app.js';
import Customer from '../models/customer.model.js';
import { registerCustomer, validCustomer } from './helpers/fixtures.js';

const request = supertest(createApp());

describe('POST /customers/register', () => {
  before(startTestDatabase);
  after(stopTestDatabase);
  beforeEach(clearDatabase);

  it('registers a customer and returns 201 without the password', async () => {
    const res = await registerCustomer(request);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Customer registered successfully');
    const { customer } = res.body;
    assert.ok(customer._id);
    assert.equal(customer.fullName, 'John Doe');
    assert.equal(customer.email, 'john@gmail.com');
    assert.equal(customer.phone, '9876543210');
    assert.ok(!Number.isNaN(Date.parse(customer.createdAt)));
    assert.equal('password' in customer, false);
    assert.equal('tokenVersion' in customer, false);
    assert.doesNotMatch(JSON.stringify(res.body), /\$2[aby]\$/);
  });

  it('stores the password as a bcrypt hash, never in plain text', async () => {
    await registerCustomer(request);
    const stored = await Customer.findOne({ email: 'john@gmail.com' }).select('+password').lean();

    assert.notEqual(stored.password, 'john123');
    assert.match(stored.password, /^\$2[aby]\$\d{2}\$/);
    assert.equal(await bcrypt.compare('john123', stored.password), true);
  });

  it('excludes the password from normal queries', async () => {
    await registerCustomer(request);
    const customer = await Customer.findOne({ email: 'john@gmail.com' }).lean();
    assert.equal(customer.password, undefined);
  });

  it('normalises the email (trim + lowercase)', async () => {
    const res = await registerCustomer(request, { email: '  John.DOE@Gmail.COM  ' });
    assert.equal(res.status, 201);
    assert.equal(res.body.customer.email, 'john.doe@gmail.com');
  });

  for (const field of ['fullName', 'email', 'password', 'phone']) {
    it(`returns 400 when ${field} is missing`, async () => {
      const body = validCustomer();
      delete body[field];
      const res = await request.post('/customers/register').send(body);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors[field]);
      assert.equal(await Customer.countDocuments(), 0);
    });

    it(`returns 400 when ${field} is empty or whitespace only`, async () => {
      for (const value of ['', '    ']) {
        const res = await registerCustomer(request, { [field]: value });
        assert.equal(res.status, 400, `value ${JSON.stringify(value)}`);
        assert.ok(res.body.errors[field]);
      }
      assert.equal(await Customer.countDocuments(), 0);
    });
  }

  it('returns 400 for an empty request body', async () => {
    const res = await request.post('/customers/register').send({});
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body.errors).sort(), ['email', 'fullName', 'password', 'phone']);
  });

  it('returns 400 for an invalid email address', async () => {
    for (const email of ['john', 'john@', 'john@gmail', 'john doe@gmail.com']) {
      const res = await registerCustomer(request, { email });
      assert.equal(res.status, 400, email);
      assert.ok(res.body.errors.email);
    }
  });

  it('returns 400 when the password is shorter than six characters', async () => {
    const res = await registerCustomer(request, { password: '12345' });
    assert.equal(res.status, 400);
    assert.match(res.body.errors.password, /at least 6/);
  });

  it('rejects passwords longer than bcrypt can hash instead of truncating them', async () => {
    const res = await registerCustomer(request, { password: 'a'.repeat(73) });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.password);
  });

  it('returns 400 for an invalid phone number', async () => {
    const res = await registerCustomer(request, { phone: '12ab' });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.phone);
  });

  it('rejects non-string values such as MongoDB operators', async () => {
    const res = await registerCustomer(request, { email: { $gt: '' } });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.email);
  });

  it('returns 409 for a duplicate email, ignoring case', async () => {
    await registerCustomer(request);
    const res = await registerCustomer(request, { email: 'JOHN@gmail.com' });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /already exists/);
    assert.equal(await Customer.countDocuments(), 1);
  });

  it('handles concurrent registrations with the same email (one 201, the rest 409)', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => registerCustomer(request)),
    );
    const statuses = responses.map((res) => res.status).sort();

    assert.deepEqual(statuses, [201, 409, 409, 409, 409]);
    assert.equal(await Customer.countDocuments({ email: 'john@gmail.com' }), 1);
  });

  it('maps a unique-index violation (E11000) that slips past the existence check to 409', async (t) => {
    await registerCustomer(request);
    t.mock.method(Customer, 'exists', async () => null);
    const res = await registerCustomer(request);

    assert.equal(res.status, 409);
    assert.match(res.body.message, /already exists/);
    assert.equal(await Customer.countDocuments(), 1);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request
      .post('/customers/register')
      .set('Content-Type', 'application/json')
      .send('{"fullName": "John",');
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Malformed JSON/);
  });

  it('returns a generic 500 when the database fails unexpectedly', async (t) => {
    t.mock.method(Customer, 'create', async () => {
      throw new Error('simulated database failure');
    });
    const res = await registerCustomer(request);

    assert.equal(res.status, 500);
    assert.equal(res.body.success, false);
    assert.doesNotMatch(res.body.message, /simulated/);
  });
});
