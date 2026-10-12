import jwt from 'jsonwebtoken';
import Customer from '../models/customer.model.js';
import HttpError from '../utils/httpError.js';
import { JWT_ALGORITHM } from '../utils/generateToken.js';
import { getJwtSecret } from '../config/env.js';
import { AUTH_COOKIE_NAME, getClearCookieOptions } from '../config/cookie.js';

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const NOT_LOGGED_IN = 'You are not logged in. Please log in to continue.';
const SESSION_INVALID = 'Your session is invalid or has expired. Please log in again.';

/**
 * Authenticates a request using the JWT stored in the HttpOnly auth cookie.
 * Identity comes only from the verified token — never from the body or query string.
 * On success, a password-free Customer document is attached to req.user.
 */
export async function protect(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    throw new HttpError(401, NOT_LOGGED_IN);
  }

  const rejectSession = () => {
    // Remove the unusable cookie so the browser stops sending it.
    res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());
    return new HttpError(401, SESSION_INVALID);
  };

  const secret = getJwtSecret();
  let payload;
  try {
    payload = jwt.verify(token, secret, { algorithms: [JWT_ALGORITHM] });
  } catch {
    throw rejectSession();
  }

  if (typeof payload?.sub !== 'string' || !OBJECT_ID_PATTERN.test(payload.sub)) {
    throw rejectSession();
  }

  const customer = await Customer.findById(payload.sub).select('+tokenVersion');
  if (!customer || (customer.tokenVersion ?? 0) !== (payload.tv ?? 0)) {
    throw rejectSession();
  }

  req.user = customer;
  next();
}

export default protect;
