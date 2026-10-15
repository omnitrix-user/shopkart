// Mirrors the backend rules so customers get instant feedback; the API still validates everything.
export const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_BYTES = 72;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

const isBlank = (value) => !value || value.trim() === '';
const byteLength = (value) => new TextEncoder().encode(value).length;

function passwordError(password, label = 'Password') {
  if (isBlank(password)) return `${label} is required`;
  if (password.length < PASSWORD_MIN_LENGTH) return `${label} must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (byteLength(password) > PASSWORD_MAX_BYTES) return `${label} is too long`;
  return undefined;
}

export function validateRegistration({ fullName, email, password, phone }) {
  const errors = {};

  if (isBlank(fullName)) errors.fullName = 'Full name is required';
  else if (fullName.trim().length < 2) errors.fullName = 'Full name must be at least 2 characters';
  else if (fullName.trim().length > 80) errors.fullName = 'Full name must be at most 80 characters';

  if (isBlank(email)) errors.email = 'Email is required';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Please enter a valid email address';

  const pwError = passwordError(password);
  if (pwError) errors.password = pwError;

  if (isBlank(phone)) errors.phone = 'Phone number is required';
  else if (!PHONE_PATTERN.test(phone.trim().replace(/[\s\-().]/g, ''))) {
    errors.phone = 'Enter 10 to 15 digits (an optional leading + is allowed)';
  }

  return errors;
}

export function validateLogin({ email, password }) {
  const errors = {};
  if (isBlank(email)) errors.email = 'Email is required';
  if (isBlank(password)) errors.password = 'Password is required';
  return errors;
}

const SHIPPING_LIMITS = {
  fullName: ['Full name', 2, 80],
  addressLine1: ['Address', 5, 200],
  city: ['City', 2, 60],
  state: ['State', 2, 60],
};

/** Strips spaces, dashes and an optional +91 / 0 prefix — same rule as the backend. */
export const normalizeIndianPhone = (value) =>
  value.replace(/[\s-]/g, '').replace(/^(?:\+91|91(?=\d{10}$)|0(?=\d{10}$))/, '');

export function validateShippingAddress(address) {
  const errors = {};

  for (const [field, [label, min, max]] of Object.entries(SHIPPING_LIMITS)) {
    const value = (address[field] || '').trim();
    if (!value) errors[field] = `${label} is required`;
    else if (value.length < min) errors[field] = `${label} must be at least ${min} characters`;
    else if (value.length > max) errors[field] = `${label} must be at most ${max} characters`;
  }

  if (isBlank(address.phone)) errors.phone = 'Phone number is required';
  else if (!/^[6-9]\d{9}$/.test(normalizeIndianPhone(address.phone.trim()))) {
    errors.phone = 'Enter a valid 10-digit Indian mobile number';
  }

  if (isBlank(address.pincode)) errors.pincode = 'Pincode is required';
  else if (!/^[1-9]\d{5}$/.test(address.pincode.trim())) errors.pincode = 'Pincode must be a valid 6-digit number';

  return errors;
}

export function validatePasswordChange({ oldPassword, newPassword, confirmPassword }) {
  const errors = {};
  if (isBlank(oldPassword)) errors.oldPassword = 'Current password is required';

  const pwError = passwordError(newPassword, 'New password');
  if (pwError) errors.newPassword = pwError;
  else if (newPassword === oldPassword) errors.newPassword = 'New password must be different from the current one';

  if (!errors.newPassword && confirmPassword !== newPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  return errors;
}
