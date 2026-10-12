import { clearDatabase, startTestDatabase, stopTestDatabase } from './helpers/setup.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { protect } from '../middlewares/auth.middleware.js';
import { errorHandler } from '../middlewares/error.middleware.js';
import Customer from '../models/customer.model.js';
import { AUTH_COOKIE_NAME } from '../config/cookie.js';
import { getAuthSetCookie, registerAndLogin } from './helpers/fixtures.js';

// A minimal app that exposes exactly what the middleware put on req.user.
const probeApp = express();
probeApp.use(cookieParser());
probeApp.get('/probe', protect, (req, res) => {
  res.json({ user: req.user.toObject(), hasPassword: req.user.password !== undefined });
});
probeApp.use(errorHandler);

const api = supertest(createApp());
const probe = supertest(probeApp);
const secret = () => process.env.JWT_SECRET;
const cookieFor = (token) => `${AUTH_COOKIE_NAME}=${token}`;

describe('auth middleware (protect)', () => {
  let session;

  before(startTestDatabase);
  after(stopTestDatabase);
  beforeEach(async () => {
    await clearDatabase();
    session = await registerAndLogin(api);
  });

  it('returns 401 when the auth cookie is missing', async () => {
    const res = await probe.get('/probe');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('returns 401 for a malformed token and clears the cookie', async () => {
    const res = await probe.get('/probe').set('Cookie', cookieFor('not-a-jwt'));
    assert.equal(res.status, 401);
    assert.match(getAuthSetCookie(res), /Expires=Thu, 01 Jan 1970/);
  });

  it('returns 401 for a token signed with a different secret', async () => {
    const forged = jwt.sign({ sub: session.customer._id, tv: 0 }, 'attacker-secret-attacker-secret-1234');
    const res = await probe.get('/probe').set('Cookie', cookieFor(forged));
    assert.equal(res.status, 401);
  });

  it('returns 401 for a token using the "none" algorithm', async () => {
    const unsigned = jwt.sign({ sub: session.customer._id, tv: 0 }, null, { algorithm: 'none' });
    const res = await probe.get('/probe').set('Cookie', cookieFor(unsigned));
    assert.equal(res.status, 401);
  });

  it('returns 401 for an expired token', async () => {
    const expired = jwt.sign(
      { sub: session.customer._id, tv: 0, exp: Math.floor(Date.now() / 1000) - 60 },
      secret(),
    );
    const res = await probe.get('/probe').set('Cookie', cookieFor(expired));
    assert.equal(res.status, 401);
    assert.match(res.body.message, /expired/);
  });

  it('returns 401 when the token subject is not a valid id', async () => {
    const token = jwt.sign({ sub: 'abc', tv: 0 }, secret(), { expiresIn: 60 });
    const res = await probe.get('/probe').set('Cookie', cookieFor(token));
    assert.equal(res.status, 401);
  });

  it('allows access with a valid token', async () => {
    const res = await probe.get('/probe').set('Cookie', session.cookie);
    assert.equal(res.status, 200);
  });

  it('attaches the correct password-free customer to req.user', async () => {
    const res = await probe.get('/probe').set('Cookie', session.cookie);
    assert.equal(res.body.user._id, session.customer._id);
    assert.equal(res.body.user.email, 'john@gmail.com');
    assert.equal(res.body.user.fullName, 'John Doe');
    assert.equal(res.body.hasPassword, false);
    assert.equal(res.body.user.password, undefined);
  });

  it('returns 401 when the customer no longer exists', async () => {
    await Customer.deleteOne({ _id: session.customer._id });
    const res = await probe.get('/probe').set('Cookie', session.cookie);
    assert.equal(res.status, 401);
  });

  it('ignores customer ids supplied in the query string or body', async () => {
    const other = await registerAndLogin(api, { email: 'jane@gmail.com', fullName: 'Jane Roe' });
    const res = await api
      .get(`/customers/me?_id=${other.customer._id}&id=${other.customer._id}`)
      .set('Cookie', session.cookie);
    assert.equal(res.status, 200);
    assert.equal(res.body._id, session.customer._id);
  });
});
