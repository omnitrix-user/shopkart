import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';
import HttpError from '../utils/httpError.js';
import { requireObjectId } from '../utils/objectId.js';

const WISHLIST_PRODUCT_FIELDS = 'name price category image stock';

/** Ensures the product exists before it is referenced from a wishlist. */
async function requireProduct(productId) {
  if (!(await Product.exists({ _id: productId }))) {
    throw new HttpError(404, 'Product not found');
  }
}

/** POST /wishlist/:productId */
export async function addToWishlist(req, res) {
  const productId = requireObjectId(req.params.productId, 'product ID');
  await requireProduct(productId);

  // The `$ne` condition makes check-and-insert a single atomic operation,
  // so two simultaneous requests cannot both add the same product.
  const result = await Customer.updateOne(
    { _id: req.user._id, wishlist: { $ne: productId } },
    { $push: { wishlist: productId } },
  );
  if (result.modifiedCount === 0) {
    throw new HttpError(409, 'Product is already in your wishlist');
  }

  res.status(201).json({ success: true, message: 'Product added to wishlist' });
}

/** GET /wishlist — the current customer's wishlist, populated with live product data. */
export async function getWishlist(req, res) {
  const customer = await Customer.findById(req.user._id).select('wishlist').lean();
  if (!customer) {
    throw new HttpError(401, 'Your session is invalid or has expired. Please log in again.');
  }

  const storedIds = [...customer.wishlist];
  await Customer.populate(customer, { path: 'wishlist', select: WISHLIST_PRODUCT_FIELDS });
  const wishlist = customer.wishlist.filter(Boolean);

  // populate() skips references to products that have since been deleted; drop those ids.
  if (wishlist.length < storedIds.length) {
    const liveIds = new Set(wishlist.map((product) => String(product._id)));
    const deletedIds = storedIds.filter((id) => !liveIds.has(String(id)));
    await Customer.updateOne({ _id: req.user._id }, { $pull: { wishlist: { $in: deletedIds } } });
  }

  res.status(200).json({ success: true, count: wishlist.length, wishlist });
}

/** DELETE /wishlist/:productId */
export async function removeFromWishlist(req, res) {
  const productId = requireObjectId(req.params.productId, 'product ID');

  const result = await Customer.updateOne(
    { _id: req.user._id, wishlist: productId },
    { $pull: { wishlist: productId } },
  );
  if (result.modifiedCount === 0) {
    throw new HttpError(404, 'Product is not in your wishlist');
  }

  res.status(200).json({ success: true, message: 'Product removed from wishlist' });
}

/** PATCH /wishlist/:productId/toggle — adds the product if absent, removes it if present. */
export async function toggleWishlist(req, res) {
  const productId = requireObjectId(req.params.productId, 'product ID');

  const removed = await Customer.updateOne(
    { _id: req.user._id, wishlist: productId },
    { $pull: { wishlist: productId } },
  );
  if (removed.modifiedCount > 0) {
    return res.status(200).json({ success: true, saved: false, message: 'Product removed from wishlist' });
  }

  await requireProduct(productId);
  await Customer.updateOne(
    { _id: req.user._id, wishlist: { $ne: productId } },
    { $push: { wishlist: productId } },
  );
  res.status(200).json({ success: true, saved: true, message: 'Product added to wishlist' });
}
