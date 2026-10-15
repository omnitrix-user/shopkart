/**
 * Adds the sample product catalogue to the database in MONGODB_URI.
 *   npm run seed            insert missing products (keeps your price/stock edits)
 *   npm run seed -- --reset restore sample products to their original price and stock
 */
import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { seedProducts } from '../utils/seedProducts.js';

dotenv.config({ quiet: true });

if (!process.env.MONGODB_URI) {
  console.error('[seed] MONGODB_URI is not set in backend/.env');
  process.exit(1);
}

try {
  await connectDatabase(process.env.MONGODB_URI.trim());
  const reset = process.argv.includes('--reset');
  const { inserted, updated, total } = await seedProducts({ reset });
  console.log(`[seed] ${total} sample products: ${inserted} inserted, ${updated} ${reset ? 'reset' : 'updated'}.`);
} catch (error) {
  console.error(`[seed] Failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
