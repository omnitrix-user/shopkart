import HttpError from '../utils/httpError.js';
import { isTest } from '../config/env.js';
import { isDatabaseConnected } from '../config/db.js';

export const DUPLICATE_EMAIL_MESSAGE = 'An account with this email already exists';
const GENERIC_SERVER_ERROR = 'Something went wrong on our side. Please try again later.';

export function requireDatabase(_req, _res, next) {
  if (!isDatabaseConnected()) {
    throw new HttpError(503, 'The service is temporarily unavailable. Please try again shortly.');
  }
  next();
}

export function notFound(req, _res) {
  throw new HttpError(404, `Route not found: ${req.method} ${req.path}`);
}

// Express identifies error handlers by their four-argument signature.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  const send = (status, message, errors) =>
    res.status(status).json({ success: false, message, ...(errors ? { errors } : {}) });

  if (err instanceof HttpError) {
    return send(err.status, err.message, err.errors);
  }

  if (err?.type === 'entity.parse.failed') {
    return send(400, 'Malformed JSON in request body.');
  }

  if (err?.type === 'entity.too.large') {
    return send(413, 'Request body is too large.');
  }

  if (err?.name === 'ValidationError' && err.errors) {
    const errors = Object.fromEntries(
      Object.entries(err.errors).map(([field, detail]) => [field, detail.message]),
    );
    return send(400, Object.values(errors)[0] || 'Invalid input.', errors);
  }

  if (err?.code === 11000) {
    if (err.keyPattern?.email || err.keyValue?.email) {
      return send(409, DUPLICATE_EMAIL_MESSAGE, { email: DUPLICATE_EMAIL_MESSAGE });
    }
    return send(409, 'A record with these details already exists.');
  }

  if (err?.name === 'CastError') {
    return send(400, 'Invalid request parameter.');
  }

  if (!isTest()) {
    // Log only the error itself — never request bodies, cookies or tokens.
    console.error(`[error] ${err?.name || 'Error'}: ${err?.message}`);
    if (err?.stack) console.error(err.stack);
  }
  return send(500, GENERIC_SERVER_ERROR);
}
