import Product from '../models/product.model.js';
import sampleProducts from '../data/products.js';

/**
 * Inserts any sample products that are missing (matched by name).
 * With { reset: true } existing sample products are also restored to their original price/stock.
 */
export async function seedProducts({ reset = false } = {}) {
  const operations = sampleProducts.map((product) => ({
    updateOne: {
      filter: { name: product.name },
      update: reset ? { $set: product } : { $setOnInsert: product },
      upsert: true,
    },
  }));
  const result = await Product.bulkWrite(operations);
  return { inserted: result.upsertedCount, updated: result.modifiedCount, total: sampleProducts.length };
}
