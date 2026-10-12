import { getCookieSameSite, getTokenTtlSeconds, isProduction } from './env.js';

export const AUTH_COOKIE_NAME = 'shopkart_token';

/**
 * Options shared by setting and clearing the auth cookie. Browsers only delete a cookie
 * when the name, path and domain match the ones it was created with.
 */
function baseCookieOptions() {
  const sameSite = getCookieSameSite();
  const secure =
    sameSite === 'none' ||
    (process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction());

  const options = { httpOnly: true, secure, sameSite, path: '/' };
  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }
  return options;
}

export function getAuthCookieOptions() {
  return { ...baseCookieOptions(), maxAge: getTokenTtlSeconds() * 1000 };
}

export function getClearCookieOptions() {
  return baseCookieOptions();
}
