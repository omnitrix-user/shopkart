const DEFAULT_TOKEN_TTL_HOURS = 24;
const VALID_SAME_SITE = ['lax', 'strict', 'none'];
const MIN_SECRET_LENGTH = 32;

export const isProduction = () => process.env.NODE_ENV === 'production';
export const isTest = () => process.env.NODE_ENV === 'test';

/** Single-service deployment: the API also serves the built React app from frontend/dist. */
export const shouldServeFrontend = () => process.env.SERVE_FRONTEND === 'true';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters long.`);
  }
  return secret;
}

export function getTokenTtlSeconds() {
  const hours = Number(process.env.JWT_EXPIRES_IN_HOURS ?? DEFAULT_TOKEN_TTL_HOURS);
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error('JWT_EXPIRES_IN_HOURS must be a positive number.');
  }
  return Math.round(hours * 60 * 60);
}

export function getAllowedOrigins() {
  const raw = process.env.FRONTEND_URL || (isProduction() ? '' : 'http://localhost:5173');
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function getBcryptSaltRounds() {
  const fallback = isTest() ? 4 : 12;
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? fallback);
  return Number.isInteger(rounds) && rounds >= 4 && rounds <= 15 ? rounds : fallback;
}

export function getCookieSameSite() {
  return (process.env.COOKIE_SAME_SITE || 'lax').trim().toLowerCase();
}

/**
 * Validates configuration required to serve authenticated traffic.
 * Returns a list of human-readable problems (never including secret values).
 */
export function validateEnvironment() {
  const problems = [];

  if (!process.env.MONGODB_URI || !process.env.MONGODB_URI.trim()) {
    problems.push('MONGODB_URI is not set. Add your MongoDB Atlas or local connection string to backend/.env.');
  }

  try {
    getJwtSecret();
  } catch (error) {
    problems.push(`${error.message} Generate one with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`);
  }

  try {
    getTokenTtlSeconds();
  } catch (error) {
    problems.push(error.message);
  }

  if (getAllowedOrigins().length === 0 && !shouldServeFrontend()) {
    problems.push('FRONTEND_URL must be set to the exact origin of the deployed frontend (e.g. https://shopkart.example.com).');
  }

  const sameSite = getCookieSameSite();
  if (!VALID_SAME_SITE.includes(sameSite)) {
    problems.push(`COOKIE_SAME_SITE must be one of: ${VALID_SAME_SITE.join(', ')}.`);
  }

  if (process.env.COOKIE_SECURE === 'false' && sameSite === 'none') {
    problems.push('COOKIE_SAME_SITE=none requires Secure cookies; COOKIE_SECURE cannot be false.');
  }

  return problems;
}
