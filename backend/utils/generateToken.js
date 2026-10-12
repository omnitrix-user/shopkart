import jwt from 'jsonwebtoken';
import { getJwtSecret, getTokenTtlSeconds } from '../config/env.js';

export const JWT_ALGORITHM = 'HS256';

/**
 * Signs a JWT for a customer.
 * Payload: { sub: <customer id>, tv: <token version> } — the token version lets the
 * server reject tokens issued before the customer's last password change.
 */
export default function generateToken(customer) {
  const payload = {
    sub: String(customer._id),
    tv: customer.tokenVersion ?? 0,
  };

  return jwt.sign(payload, getJwtSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: getTokenTtlSeconds(),
  });
}
