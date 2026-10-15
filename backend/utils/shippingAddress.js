export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;
export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

const FIELDS = {
  fullName: { label: 'Full name', min: 2, max: 80 },
  // Phone and pincode lengths are enforced by their patterns below.
  phone: { label: 'Phone number', min: 1, max: 20 },
  addressLine1: { label: 'Address', min: 5, max: 200 },
  city: { label: 'City', min: 2, max: 60 },
  state: { label: 'State', min: 2, max: 60 },
  pincode: { label: 'Pincode', min: 1, max: 10 },
};

/** Strips spaces, dashes and an optional +91 / 0 prefix from an Indian mobile number. */
export const normalizeIndianPhone = (value) =>
  value.replace(/[\s-]/g, '').replace(/^(?:\+91|91(?=\d{10}$)|0(?=\d{10}$))/, '');

/**
 * Validates a checkout shipping address. Non-string values are rejected so that
 * objects cannot be smuggled into the order document.
 * Returns { errors, data } where errors is empty when valid.
 */
export function validateShippingAddress(input) {
  const errors = {};
  const data = {};
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};

  for (const [field, rule] of Object.entries(FIELDS)) {
    const raw = source[field];
    const value = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
    if (!value) {
      errors[field] = `${rule.label} is required`;
    } else if (value.length < rule.min || value.length > rule.max) {
      errors[field] = `${rule.label} must be between ${rule.min} and ${rule.max} characters`;
    }
    data[field] = value;
  }

  if (!errors.phone) {
    data.phone = normalizeIndianPhone(data.phone);
    if (!INDIAN_MOBILE_PATTERN.test(data.phone)) {
      errors.phone = 'Enter a valid 10-digit Indian mobile number';
    }
  }

  if (!errors.pincode && !PINCODE_PATTERN.test(data.pincode)) {
    errors.pincode = 'Pincode must be a valid 6-digit number';
  }

  return { errors, data };
}
