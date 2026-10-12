import { clearDatabase, startTestDatabase, stopTestDatabase } from './helpers/setup.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { getAuthSetCookie, registerCustomer } from './helpers/fixtures.js';
import { AUTH_COOKIE_NAME } from '../config/cookie.js';

const request = supertest(createApp());
const login = (body) => request.post('/customers/login').send(body);

describe('POST /customers/login', () => {
  before(startTestDatabase);
  after(stopTestDatabase);
  beforeEach(async () => {
    await clearDatabase();
    await registerCustomer(request);
  });

  it('logs in with valid credentials and returns the success response', async () => {
    const res = await login({ email: 'john@gmail.com', password: 'john123' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Login successful');
    assert.equal(res.body.customer.email, 'john@gmail.com');
    assert.equal('password' in res.body.customer, false);
    assert.doesNotMatch(JSON.stringify(res.body), /\$2[aby]\$/);
  });

  it('sets a signed JWT in an HttpOnly cookie with an explicit expiry', async () => {
    const res = await login({ email: 'john@gmail.com', password: 'john123' });
    const setCookie = getAuthSetCookie(res);

    assert.ok(setCookie, 'auth cookie should be set');
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Path=\//);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Max-Age=86400/);
    assert.doesNotMatch(setCookie, /Secure/i, 'Secure is off for local development over http');

    const token = setCookie.split(';')[0].slice(AUTH_COOKIE_NAME.length + 1);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    assert.equal(payload.sub, res.body.customer._id);
    assert.equal(payload.exp - payload.iat, 86400);
  });

  it('does not put the token in the response body', async () => {
    const res = await login({ email: 'john@gmail.com', password: 'john123' });
    assert.equal(res.body.token, undefined);
  });

  it('accepts the email in any case or with surrounding spaces', async () => {
    const res = await login({ email: '  JOHN@Gmail.com ', password: 'john123' });
    assert.equal(res.status, 200);
  });

  it('returns 401 for an unknown email', async () => {
    const res = await login({ email: 'nobody@gmail.com', password: 'john123' });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Invalid Credentials');
    assert.equal(getAuthSetCookie(res), undefined);
  });

  it('returns 401 for a wrong password', async () => {
    const res = await login({ email: 'john@gmail.com', password: 'wrong-password' });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid Credentials');
    assert.equal(getAuthSetCookie(res), undefined);
  });

  it('uses the same generic message for unknown email and wrong password', async () => {
    const unknownEmail = await login({ email: 'nobody@gmail.com', password: 'john123' });
    const wrongPassword = await login({ email: 'john@gmail.com', password: 'nope123' });
    assert.deepEqual(unknownEmail.body, wrongPassword.body);
  });

  it('returns 400 when credentials are missing', async () => {
    for (const body of [{}, { email: 'john@gmail.com' }, { password: 'john123' }, { email: '  ', password: '' }]) {
      const res = await login(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.success, false);
    }
  });

  it('rejects MongoDB operator injection in the email field', async () => {
    const res = await login({ email: { $ne: null }, password: 'john123' });
    assert.equal(res.status, 400);
    assert.equal(getAuthSetCookie(res), undefined);
  });
});
