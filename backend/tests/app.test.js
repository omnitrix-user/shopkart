import { startTestDatabase, stopTestDatabase } from './helpers/setup.js';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { validateEnvironment } from '../config/env.js';
import { getAuthCookieOptions } from '../config/cookie.js';

const request = supertest(createApp());

describe('application', () => {
  before(startTestDatabase);
  after(stopTestDatabase);

  it('GET /health reports a connected database', async () => {
    const res = await request.get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.database, 'connected');
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request.get('/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  it('allows credentialed CORS requests only from the configured frontend origin', async () => {
    const allowed = await request
      .options('/customers/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.equal(allowed.headers['access-control-allow-credentials'], 'true');

    const blocked = await request
      .options('/customers/login')
      .set('Origin', 'http://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    assert.equal(blocked.headers['access-control-allow-origin'], undefined);
  });

  it('does not expose framework details', async () => {
    const res = await request.get('/health');
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});

describe('configuration', () => {
  it('reports missing MONGODB_URI and a weak JWT_SECRET without echoing secrets', () => {
    const saved = { ...process.env };
    try {
      delete process.env.MONGODB_URI;
      process.env.JWT_SECRET = 'short-secret';
      const problems = validateEnvironment().join('\n');
      assert.match(problems, /MONGODB_URI/);
      assert.match(problems, /JWT_SECRET/);
      assert.doesNotMatch(problems, /short-secret/);
    } finally {
      process.env = saved;
    }
  });

  it('forces Secure cookies in production and with SameSite=None', () => {
    const saved = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      assert.equal(getAuthCookieOptions().secure, true);

      process.env.NODE_ENV = 'development';
      process.env.COOKIE_SAME_SITE = 'none';
      const options = getAuthCookieOptions();
      assert.equal(options.sameSite, 'none');
      assert.equal(options.secure, true);
      assert.equal(options.httpOnly, true);
    } finally {
      process.env = saved;
    }
  });
});

describe('database unavailable', () => {
  before(() => mongoose.disconnect());

  it('returns 503 instead of hanging when MongoDB is down', async () => {
    const health = await request.get('/health');
    assert.equal(health.status, 503);
    assert.equal(health.body.database, 'disconnected');

    const res = await request.post('/customers/login').send({ email: 'a@b.co', password: 'secret1' });
    assert.equal(res.status, 503);
  });
});
