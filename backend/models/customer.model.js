import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { getBcryptSaltRounds } from '../config/env.js';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;
export const PASSWORD_MIN_LENGTH = 6;
// bcrypt only uses the first 72 bytes of its input; longer passwords are rejected instead of truncated.
export const PASSWORD_MAX_BYTES = 72;

const customerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [80, 'Full name must be at most 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: [254, 'Email must be at most 254 characters'],
      match: [EMAIL_PATTERN, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [PHONE_PATTERN, 'Phone number must contain 10 to 15 digits'],
    },
    // Incremented on password change so that previously issued JWTs stop working.
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.tokenVersion;
        return ret;
      },
    },
  },
);

customerSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, getBcryptSaltRounds());
});

customerSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) {
    throw new Error('Password hash was not selected for this query.');
  }
  return bcrypt.compare(candidate, this.password);
};

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

export default Customer;
