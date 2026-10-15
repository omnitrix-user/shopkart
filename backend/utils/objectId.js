import HttpError from './httpError.js';

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export const isObjectIdString = (value) => typeof value === 'string' && OBJECT_ID_PATTERN.test(value);

export function requireObjectId(value, label = 'ID') {
  if (!isObjectIdString(value)) {
    throw new HttpError(400, `Invalid ${label}`);
  }
  return value;
}
