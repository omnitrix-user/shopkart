import { clearDatabase, startTestDatabase, stopTestDatabase } from './helpers/setup.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../app.js';
import Customer from '../models/customer.model.js';
import { getAuthCookiePair, registerAndLogin } from './helpers/fixtures.js';

const request = supertest(createApp());
const changePassword = (cookie, body) => {
  const req = request.patch('/customers/change-password');
  return cookie ? req.set('Cookie', cookie).send(body) : req.send(body);
};

describe('PATCH /customers/change-password', () => {
  let session;

  before(startTestDatabase);
  after(stopTestDatabase);
  beforeEach(async () => {
    await clearDatabase();
    session = await registerAndLogin(request);
  });

  it('requires authentication', async () => {
    const res = await changePassword(undefined, { oldPassword: 'john123', newPassword: 'newpass1' });
    assert.equal(res.status, 401);
  });

  it('validates required fields and the new password length', async () => {
    const cases = [
      {},
      { oldPassword: 'john123' },
      { newPassword: 'newpass1' },
      { oldPassword: 'john123', newPassword: '123' },
      { oldPassword: 'john123', newPassword: 'john123' },
    ];
    for (const body of cases) {
      const res = await changePassword(session.cookie, body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  it('rejects an incorrect current password', async () => {
    const res = await changePassword(session.cookie, { oldPassword: 'wrong1', newPassword: 'newpass1' });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.oldPassword);
  });

  it('hashes the new password and allows logging in with it', async () => {
    const res = await changePassword(session.cookie, { oldPassword: 'john123', newPassword: 'newpass1' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.doesNotMatch(JSON.stringify(res.body), /\$2[aby]\$/);

    const stored = await Customer.findById(session.customer._id).select('+password').lean();
    assert.match(stored.password, /^\$2[aby]\$/);
    assert.equal(await bcrypt.compare('newpass1', stored.password), true);

    const oldLogin = await request.post('/customers/login').send({ email: 'john@gmail.com', password: 'john123' });
    const newLogin = await request.post('/customers/login').send({ email: 'john@gmail.com', password: 'newpass1' });
    assert.equal(oldLogin.status, 401);
    assert.equal(newLogin.status, 200);
  });

  it('rejects tokens issued before the change and keeps the current browser signed in', async () => {
    const res = await changePassword(session.cookie, { oldPassword: 'john123', newPassword: 'newpass1' });
    const freshCookie = getAuthCookiePair(res);

    assert.equal((await request.get('/customers/me').set('Cookie', session.cookie)).status, 401);
    assert.ok(freshCookie);
    assert.equal((await request.get('/customers/me').set('Cookie', freshCookie)).status, 200);
  });
});
