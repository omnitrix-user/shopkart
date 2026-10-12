import { clearDatabase, startTestDatabase, stopTestDatabase } from './helpers/setup.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createApp } from '../app.js';
import { getAuthSetCookie, registerAndLogin } from './helpers/fixtures.js';

const request = supertest(createApp());

describe('GET /customers/me', () => {
  before(startTestDatabase);
  after(stopTestDatabase);
  beforeEach(clearDatabase);

  it('returns the authenticated customer from the database', async () => {
    const { cookie, customer } = await registerAndLogin(request);
    const res = await request.get('/customers/me').set('Cookie', cookie);

    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ['_id', 'createdAt', 'email', 'fullName', 'phone']);
    assert.equal(res.body._id, customer._id);
    assert.equal(res.body.fullName, 'John Doe');
    assert.equal(res.body.email, 'john@gmail.com');
    assert.equal(res.body.phone, '9876543210');
    assert.equal(res.body.createdAt, customer.createdAt);
  });

  it('never includes the password hash', async () => {
    const { cookie } = await registerAndLogin(request);
    const res = await request.get('/customers/me').set('Cookie', cookie);
    assert.equal(res.body.password, undefined);
    assert.doesNotMatch(JSON.stringify(res.body), /\$2[aby]\$/);
  });

  it('returns 401 without a cookie', async () => {
    const res = await request.get('/customers/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('derives identity from the verified token for each customer', async () => {
    const john = await registerAndLogin(request);
    const jane = await registerAndLogin(request, {
      fullName: 'Jane Roe',
      email: 'jane@gmail.com',
      phone: '+919812345678',
    });

    const johnRes = await request.get('/customers/me').set('Cookie', john.cookie);
    const janeRes = await request.get('/customers/me').set('Cookie', jane.cookie);
    assert.equal(johnRes.body.email, 'john@gmail.com');
    assert.equal(janeRes.body.email, 'jane@gmail.com');
    assert.equal(janeRes.body.phone, '+919812345678');
  });
});

describe('POST /customers/logout', () => {
  before(startTestDatabase);
  after(stopTestDatabase);
  beforeEach(clearDatabase);

  it('clears the auth cookie with matching attributes and returns success', async () => {
    const { cookie } = await registerAndLogin(request);
    const res = await request.post('/customers/logout').set('Cookie', cookie);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true, message: 'Logged out successfully' });

    const cleared = getAuthSetCookie(res);
    assert.ok(cleared, 'logout must send a Set-Cookie header');
    assert.match(cleared, /^shopkart_token=;/);
    assert.match(cleared, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
    assert.match(cleared, /Path=\//);
    assert.match(cleared, /HttpOnly/i);
    assert.match(cleared, /SameSite=Lax/i);
  });

  it('denies protected access once the cookie has been removed', async () => {
    const agent = supertest.agent(createApp());
    await agent.post('/customers/register').send({
      fullName: 'John Doe',
      email: 'john@gmail.com',
      password: 'john123',
      phone: '9876543210',
    });
    await agent.post('/customers/login').send({ email: 'john@gmail.com', password: 'john123' });

    assert.equal((await agent.get('/customers/me')).status, 200);
    assert.equal((await agent.post('/customers/logout')).status, 200);
    assert.equal((await agent.get('/customers/me')).status, 401);
  });

  it('requires authentication', async () => {
    const res = await request.post('/customers/logout');
    assert.equal(res.status, 401);
  });

  it('handles an expired/invalid session gracefully by clearing the cookie', async () => {
    const res = await request.post('/customers/logout').set('Cookie', 'shopkart_token=expired.or.invalid');
    assert.equal(res.status, 401);
    assert.match(getAuthSetCookie(res), /Expires=Thu, 01 Jan 1970/);
  });
});
