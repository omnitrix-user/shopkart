import mongoose from 'mongoose';

export const ORDER_STATUSES = ['PENDING_PAYMENT', 'PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED'];

// Purchase-time snapshot: name, price and image are copied so the order stays accurate
// even if the product is edited or deleted later. `product` is kept for linking only.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String },
  },
  { _id: false },
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    items: {
      type: [orderItemSchema],
      validate: { validator: (items) => items.length > 0, message: 'An order needs at least one item' },
    },
    shippingAddress: { type: shippingAddressSchema, required: true },
    // Whole rupees, calculated on the server from current product prices.
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'PENDING' },
    status: { type: String, enum: ORDER_STATUSES, default: 'PENDING_PAYMENT' },
    statusHistory: { type: [statusEventSchema], default: () => [{ status: 'PENDING_PAYMENT' }] },
    razorpayOrderId: { type: String, index: true, sparse: true },
    razorpayPaymentId: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

orderSchema.index({ user: 1, createdAt: -1 });

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

export default Order;
