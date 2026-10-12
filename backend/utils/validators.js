import {
  EMAIL_PATTERN,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  PHONE_PATTERN,
} from '../models/customer.model.js';

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const normalizeEmail = (email) => email.trim().toLowerCase();

const normalizePhone = (phone) => phone.trim().replace(/[\s\-().]/g, '');

/**
 * Reads a field that must be a non-blank string. Non-string values (objects, numbers, arrays)
 * are rejected so they can never reach a MongoDB query as an operator.
 */
function readRequiredString(body, field, label, errors) {
  const value = body[field];
  if (value === undefined || value === null || value === '') {
    errors[field] = `${label} is required`;
    return undefined;
  }
  if (typeof value !== 'string') {
    errors[field] = `${label} must be text`;
    return undefined;
  }
  if (value.trim() === '') {
    errors[field] = `${label} cannot be blank`;
    return undefined;
  }
  return value;
}

function checkNewPassword(password, field, label, errors) {
  if (password === undefined) return;
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors[field] = `${label} must be at least ${PASSWORD_MIN_LENGTH} characters`;
  } else if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    errors[field] = `${label} must be at most ${PASSWORD_MAX_BYTES} bytes long`;
  }
}

const result = (errors, data) =>
  Object.keys(errors).length > 0 ? { errors, data: null } : { errors: null, data };

export function validateRegistration(input) {
  const body = isPlainObject(input) ? input : {};
  const errors = {};

  const fullName = readRequiredString(body, 'fullName', 'Full name', errors);
  const email = readRequiredString(body, 'email', 'Email', errors);
  const password = readRequiredString(body, 'password', 'Password', errors);
  const phone = readRequiredString(body, 'phone', 'Phone number', errors);

  const data = {};

  if (fullName !== undefined) {
    data.fullName = fullName.trim().replace(/\s+/g, ' ');
    if (data.fullName.length < 2 || data.fullName.length > 80) {
      errors.fullName = 'Full name must be between 2 and 80 characters';
    }
  }

  if (email !== undefined) {
    data.email = normalizeEmail(email);
    if (data.email.length > 254 || !EMAIL_PATTERN.test(data.email)) {
      errors.email = 'Please provide a valid email address';
    }
  }

  checkNewPassword(password, 'password', 'Password', errors);
  data.password = password;

  if (phone !== undefined) {
    data.phone = normalizePhone(phone);
    if (!PHONE_PATTERN.test(data.phone)) {
      errors.phone = 'Phone number must contain 10 to 15 digits (an optional leading + is allowed)';
    }
  }

  return result(errors, data);
}

export function validateLogin(input) {
  const body = isPlainObject(input) ? input : {};
  const errors = {};

  const email = readRequiredString(body, 'email', 'Email', errors);
  const password = readRequiredString(body, 'password', 'Password', errors);

  return result(errors, { email: email && normalizeEmail(email), password });
}

export function validatePasswordChange(input) {
  const body = isPlainObject(input) ? input : {};
  const errors = {};

  const oldPassword = readRequiredString(body, 'oldPassword', 'Current password', errors);
  const newPassword = readRequiredString(body, 'newPassword', 'New password', errors);

  checkNewPassword(newPassword, 'newPassword', 'New password', errors);
  if (!errors.newPassword && oldPassword !== undefined && oldPassword === newPassword) {
    errors.newPassword = 'New password must be different from the current password';
  }

  return result(errors, { oldPassword, newPassword });
}

export const firstErrorMessage = (errors) => Object.values(errors)[0];
