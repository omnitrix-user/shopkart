import mongoose from 'mongoose';
import Customer from '../models/customer.model.js';

export async function connectDatabase(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  // Make sure the unique email index exists before accepting registrations.
  await Customer.createIndexes();
  return mongoose.connection;
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
