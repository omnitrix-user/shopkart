/**
 * Starts a real local MongoDB server (official mongod binary, downloaded and cached by
 * mongodb-memory-server) for machines that do not have MongoDB installed.
 * Data is persisted in backend/.mongo-data so accounts survive restarts.
 *
 * Usage: npm run db:local   then set MONGODB_URI=mongodb://127.0.0.1:27017/shopkart
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const port = Number(process.env.LOCAL_MONGO_PORT) || 27017;
const dbPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.mongo-data');
mkdirSync(dbPath, { recursive: true });

console.log('[db:local] Starting MongoDB (the first run downloads the mongod binary, ~100 MB)...');

let server;
try {
  server = await MongoMemoryServer.create({
    instance: { port, ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger' },
  });
} catch (error) {
  console.error(`[db:local] Could not start MongoDB on port ${port}: ${error.message}`);
  console.error('[db:local] Is another MongoDB already running on this port? Set LOCAL_MONGO_PORT to use another one.');
  process.exit(1);
}

console.log(`[db:local] MongoDB is running at mongodb://127.0.0.1:${port}`);
console.log(`[db:local] Use MONGODB_URI=mongodb://127.0.0.1:${port}/shopkart in backend/.env`);
console.log(`[db:local] Data directory: ${dbPath}`);
console.log('[db:local] Press Ctrl+C to stop.');

const stop = async () => {
  await server.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
