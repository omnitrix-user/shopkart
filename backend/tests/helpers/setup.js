/**
 * Test environment. Import this module FIRST in every test file.
 *
 * Tests never touch a development or production database: by default an ephemeral
 * MongoDB server is started for each test file. TEST_MONGODB_URI may point to another
 * server, but only if its database name contains "test".
 */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase } from '../../config/db.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-long-enough-0123456789';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.JWT_EXPIRES_IN_HOURS = '24';
process.env.BCRYPT_SALT_ROUNDS = '4';
delete process.env.COOKIE_SAME_SITE;
delete process.env.COOKIE_SECURE;
delete process.env.COOKIE_DOMAIN;
// Dummy values: Razorpay's API is always mocked in tests and never contacted.
process.env.RAZORPAY_KEY_ID = 'rzp_test_dummykeyid000';
process.env.RAZORPAY_KEY_SECRET = 'test-only-razorpay-secret';

let memoryServer;

export async function startTestDatabase() {
  let uri = process.env.TEST_MONGODB_URI;

  if (uri) {
    const dbName = new URL(uri).pathname.replace(/^\//, '');
    if (!/test/i.test(dbName)) {
      throw new Error('Refusing to run: TEST_MONGODB_URI must name a database containing "test".');
    }
  } else {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('shopkart_test');
  }

  await connectDatabase(uri);
}

export async function clearDatabase() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function stopTestDatabase() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}
