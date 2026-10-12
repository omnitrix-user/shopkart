import bcrypt from 'bcrypt';
import Customer, { PASSWORD_MAX_BYTES } from '../models/customer.model.js';
import generateToken from '../utils/generateToken.js';
import HttpError from '../utils/httpError.js';
import {
  firstErrorMessage,
  validateLogin,
  validatePasswordChange,
  validateRegistration,
} from '../utils/validators.js';
import { AUTH_COOKIE_NAME, getAuthCookieOptions, getClearCookieOptions } from '../config/cookie.js';
import { DUPLICATE_EMAIL_MESSAGE } from '../middlewares/error.middleware.js';

const INVALID_CREDENTIALS = 'Invalid Credentials';

// Compared against when an email is unknown so that both failure paths take similar time.
let dummyHashPromise;
const getDummyHash = () => {
  dummyHashPromise ??= bcrypt.hash('shopkart-timing-placeholder', 10);
  return dummyHashPromise;
};

/** POST /customers/register */
export async function registerCustomer(req, res) {
  const { errors, data } = validateRegistration(req.body);
  if (errors) {
    throw new HttpError(400, firstErrorMessage(errors), errors);
  }

  if (await Customer.exists({ email: data.email })) {
    throw new HttpError(409, DUPLICATE_EMAIL_MESSAGE, { email: DUPLICATE_EMAIL_MESSAGE });
  }

  // A concurrent registration can still pass the check above; the unique index then raises
  // E11000, which the error middleware turns into the same 409 response.
  const customer = await Customer.create(data);

  res.status(201).json({
    success: true,
    message: 'Customer registered successfully',
    customer: customer.toJSON(),
  });
}

/** POST /customers/login */
export async function loginCustomer(req, res) {
  const { errors, data } = validateLogin(req.body);
  if (errors) {
    throw new HttpError(400, firstErrorMessage(errors), errors);
  }

  if (Buffer.byteLength(data.password, 'utf8') > PASSWORD_MAX_BYTES) {
    throw new HttpError(401, INVALID_CREDENTIALS);
  }

  const customer = await Customer.findOne({ email: data.email }).select('+password +tokenVersion');

  let passwordMatches = false;
  if (customer) {
    passwordMatches = await customer.comparePassword(data.password);
  } else {
    await bcrypt.compare(data.password, await getDummyHash());
  }

  if (!passwordMatches) {
    throw new HttpError(401, INVALID_CREDENTIALS);
  }

  res.cookie(AUTH_COOKIE_NAME, generateToken(customer), getAuthCookieOptions());
  res.status(200).json({
    success: true,
    message: 'Login successful',
    customer: customer.toJSON(),
  });
}

/** GET /customers/me (protected) */
export function getCurrentCustomer(req, res) {
  res.status(200).json(req.user.toJSON());
}

/** POST /customers/logout (protected) */
export function logoutCustomer(_req, res) {
  res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());
  res.status(200).json({ success: true, message: 'Logged out successfully' });
}

/** PATCH /customers/change-password (protected) */
export async function changePassword(req, res) {
  const { errors, data } = validatePasswordChange(req.body);
  if (errors) {
    throw new HttpError(400, firstErrorMessage(errors), errors);
  }

  const customer = await Customer.findById(req.user._id).select('+password +tokenVersion');
  if (!customer) {
    throw new HttpError(401, 'Your session is invalid or has expired. Please log in again.');
  }

  if (!(await customer.comparePassword(data.oldPassword))) {
    const message = 'Current password is incorrect';
    throw new HttpError(400, message, { oldPassword: message });
  }

  customer.password = data.newPassword;
  customer.tokenVersion = (customer.tokenVersion ?? 0) + 1;
  await customer.save();

  // Older tokens now carry a stale version and are rejected; keep this browser signed in.
  res.cookie(AUTH_COOKIE_NAME, generateToken(customer), getAuthCookieOptions());
  res.status(200).json({
    success: true,
    message: 'Password changed successfully. Other sessions have been signed out.',
  });
}
