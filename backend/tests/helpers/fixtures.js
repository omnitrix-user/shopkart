import { AUTH_COOKIE_NAME } from '../../config/cookie.js';
import Product from '../../models/product.model.js';

let productCounter = 0;

/** Inserts a product directly into the test database. */
export async function createProduct(overrides = {}) {
  productCounter += 1;
  return Product.create({
    name: `Test Product ${productCounter}`,
    description: 'A product used in automated tests.',
    price: 500,
    category: 'Electronics',
    image: 'https://example.com/product.jpg',
    stock: 5,
    ...overrides,
  });
}

export const validCustomer = () => ({
  fullName: 'John Doe',
  email: 'john@gmail.com',
  password: 'john123',
  phone: '9876543210',
});

export async function registerCustomer(request, overrides = {}) {
  return request.post('/customers/register').send({ ...validCustomer(), ...overrides });
}

/** Returns the raw Set-Cookie header for the auth cookie, if present. */
export function getAuthSetCookie(response) {
  const cookies = response.headers['set-cookie'] || [];
  return cookies.find((cookie) => cookie.startsWith(`${AUTH_COOKIE_NAME}=`));
}

/** Returns "name=value" for use in a Cookie request header. */
export function getAuthCookiePair(response) {
  const header = getAuthSetCookie(response);
  return header ? header.split(';')[0] : undefined;
}

/** Registers + logs in a customer and returns { cookie, customer }. */
export async function registerAndLogin(request, overrides = {}) {
  const details = { ...validCustomer(), ...overrides };
  const registration = await registerCustomer(request, details);
  const login = await request
    .post('/customers/login')
    .send({ email: details.email, password: details.password });
  return { cookie: getAuthCookiePair(login), customer: registration.body.customer, login };
}
