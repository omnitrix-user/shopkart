import http from 'node:http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { getAllowedOrigins, shouldServeFrontend, validateEnvironment } from './config/env.js';
import { getRazorpayWarnings } from './config/razorpay.js';
import Product from './models/product.model.js';
import { seedProducts } from './utils/seedProducts.js';

dotenv.config({ quiet: true });

const PORT = Number(process.env.PORT) || 5000;

/** Hides the user/password part of a MongoDB URI for log output. */
const describeMongoUri = (uri) => {
  try {
    const { protocol, host, pathname } = new URL(uri);
    return `${protocol}//${host}${pathname}`;
  } catch {
    return '(unparseable MONGODB_URI)';
  }
};

async function start() {
  const problems = validateEnvironment();
  if (problems.length > 0) {
    console.error('\n[ShopKart] Cannot start — configuration problems in backend/.env:');
    problems.forEach((problem) => console.error(`  • ${problem}`));
    console.error('\nCopy backend/.env.example to backend/.env and fill in the values.\n');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI.trim();
  console.log(`[ShopKart] Connecting to MongoDB at ${describeMongoUri(uri)} ...`);
  try {
    await connectDatabase(uri);
  } catch (error) {
    console.error(`[ShopKart] MongoDB connection failed: ${error.message}`);
    console.error('[ShopKart] Check MONGODB_URI, that MongoDB is running, and (for Atlas) your IP access list.');
    process.exit(1);
  }
  console.log('[ShopKart] MongoDB connected.');

  if (process.env.AUTO_SEED !== 'false' && (await Product.estimatedDocumentCount()) === 0) {
    const { inserted } = await seedProducts();
    console.log(`[ShopKart] Product catalogue was empty — added ${inserted} sample products.`);
  }

  getRazorpayWarnings().forEach((warning) => console.warn(`[ShopKart] Warning: ${warning}`));

  mongoose.connection.on('disconnected', () => console.warn('[ShopKart] MongoDB disconnected.'));
  mongoose.connection.on('reconnected', () => console.log('[ShopKart] MongoDB reconnected.'));

  const server = http.createServer(createApp());

  server.on('listening', () => {
    console.log(`[ShopKart] API ready on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
    if (shouldServeFrontend()) {
      console.log('[ShopKart] Serving the React app from frontend/dist; API routes are under /api');
    } else {
      console.log(`[ShopKart] Accepting browser requests from: ${getAllowedOrigins().join(', ')}`);
    }
  });

  server.on('error', async (error) => {
    console.error(
      error.code === 'EADDRINUSE'
        ? `[ShopKart] Port ${PORT} is already in use. Stop the other process or change PORT in backend/.env.`
        : `[ShopKart] Server error: ${error.message}`,
    );
    await disconnectDatabase();
    process.exit(1);
  });

  server.listen(PORT);

  const shutdown = (signal) => {
    console.log(`[ShopKart] ${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
