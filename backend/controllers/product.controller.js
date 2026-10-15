import Product from '../models/product.model.js';
import HttpError from '../utils/httpError.js';
import { requireObjectId } from '../utils/objectId.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const readQueryString = (value, maxLength) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

/** GET /products?search=&category= */
export async function listProducts(req, res) {
  const search = readQueryString(req.query.search, 100);
  const category = readQueryString(req.query.category, 60);

  const filter = {};
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { category: pattern }, { description: pattern }];
  }
  if (category) {
    filter.category = category;
  }

  const [products, categories] = await Promise.all([
    Product.find(filter).sort({ createdAt: 1, _id: 1 }).lean(),
    Product.distinct('category'),
  ]);

  res.status(200).json({
    success: true,
    count: products.length,
    categories: categories.sort(),
    products,
  });
}

/** GET /products/:id */
export async function getProduct(req, res) {
  const id = requireObjectId(req.params.id, 'product ID');
  const product = await Product.findById(id).lean();
  if (!product) {
    throw new HttpError(404, 'Product not found');
  }
  res.status(200).json({ success: true, product });
}
