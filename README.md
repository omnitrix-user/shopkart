# ShopKart

ShopKart is a full-stack online store. Customers can register and log in, browse and search a product catalogue, save products to a wishlist, manage a cart, and check out with **Razorpay (Test Mode)**. They can then follow their orders from *Placed* to *Delivered*.

- **Backend:** Node.js, Express 5, MongoDB with Mongoose, bcrypt password hashing, JWTs stored in an HttpOnly cookie, and the official `razorpay` SDK. Structured as MVC (models, controllers, routes, middlewares, utils).
- **Frontend:** React 19 with Vite, React Router, and Axios. The cart is global state built on the Context API with `useReducer`. Styled with plain CSS: a custom design system, fully responsive.
- **Tests:** 109 automated backend tests (Node's built-in test runner + Supertest) against an isolated, throw-away MongoDB instance. Razorpay's API is mocked in tests.

> **Payments use Razorpay Test Mode only.** No real money is involved. Never put Live Mode keys in this project.

---

## 1. Features

| Area | What is implemented |
|---|---|
| Registration | `POST /customers/register`. Validates all fields (missing, empty, whitespace-only, email format, phone format, password length 6–72 bytes). Normalises email (trim + lowercase). Hashes the password with bcrypt. Duplicate email returns **409**, including concurrent duplicate requests. |
| Login | `POST /customers/login`. Generic `Invalid Credentials` (**401**) for an unknown email and for a wrong password. Issues a signed JWT (HS256, explicit expiry) in an **HttpOnly** cookie with an explicit `Max-Age`. |
| Auth middleware | Reads the cookie, verifies signature and expiry (HS256 only), loads the customer from MongoDB, and attaches a password-free `req.user`. Rejects missing, malformed, expired or forged tokens, deleted customers, and tokens issued before a password change. |
| Profile | `GET /customers/me` (protected). Returns the real database record; identity comes only from the verified token. |
| Logout | `POST /customers/logout` (protected). Clears the cookie using the same name, path, SameSite and Secure options it was created with. |
| Change password (bonus) | `PATCH /customers/change-password` (protected). Verifies the old password with `bcrypt.compare`, hashes the new one, and invalidates every previously issued token. |
| Health | `GET /health`. Reports whether MongoDB is connected (`200`, or `503` if not). |
| Product catalogue | `GET /products` (search by text, filter by category) and `GET /products/:id`. 14 sample products are seeded automatically in development when the collection is empty, or with `npm run seed`. |
| Wishlist (Lab 04) | `POST`, `GET`, `DELETE /wishlist/:productId` and the bonus `PATCH /wishlist/:productId/toggle`. The wishlist stores product references only (no copied product data) and is populated on read. Duplicates return **409**; this is enforced atomically, so concurrent clicks can't create duplicates. The customer is always taken from the cookie: no route accepts a user id. |
| Cart (Lab 05) | `POST /cart/:productId` adds 1 or increments the quantity, `PATCH` sets a quantity, `DELETE` removes a line, and `GET` returns the populated cart. Quantity is always a whole number ≥ 1 and never more than current stock (also enforced atomically). The cart count and subtotal are derived on the client, never stored. |
| Checkout & orders (Lab 06) | `POST /orders/create-payment-order` prices the cart **on the server** from current product data and creates a pending order plus a Razorpay order (amount in paise). `POST /orders/verify-payment` checks the HMAC-SHA256 signature using the secret and the *stored* Razorpay order id; only then is the order marked **PAID / PLACED**, stock reduced and the cart cleared. Also: `GET /orders`, `GET /orders/:id` (owner only) and `POST /orders/:id/payment-failed`. |
| Order status (bonus) | `PATCH /orders/:id/status` moves a paid order forward through PLACED → CONFIRMED → SHIPPED → DELIVERED, shown as a timeline. It's a demo endpoint, disabled when `NODE_ENV=production` unless `ENABLE_ORDER_STATUS_DEMO=true`. |
| Frontend | Public `/products` and `/products/:id`. Protected `/home`, `/wishlist`, `/cart`, `/checkout`, `/order-success/:id`, `/orders` and `/orders/:id`. `/register` and `/login` are guest-only. The navbar shows Home · Products · Wishlist (n) · Cart (n) · Orders · Logout; both counts come from the backend. Every data page has loading, empty and error (Try Again) states. Shopping actions show their progress (`⏳ Saving...`, `Adding...`). The layout is responsive from 320 px to desktop. |

Password hashes are never returned by any endpoint, and passwords, tokens and secrets are never logged. `RAZORPAY_KEY_SECRET` is only read on the backend and is never sent to the browser.

---

## 2. Technology stack

| Layer | Packages |
|---|---|
| Backend | `express` 5, `mongoose` 9, `bcrypt` 6, `jsonwebtoken` 9, `cookie-parser`, `cors`, `dotenv`, `razorpay` 2 |
| Backend dev/test | Node's built-in `node:test` and `--watch`, `supertest`, `mongodb-memory-server` |
| Frontend | `react` 19, `react-dom`, `react-router-dom` 7, `axios`, `vite` 8, `@vitejs/plugin-react` |
| Tooling | npm workspaces, `concurrently` |

No authentication frameworks (Passport, Firebase, Auth0, Clerk), no Redux, and no UI kits are used. Card details are collected only by Razorpay Checkout; ShopKart has no card form and stores only Razorpay order and payment ids.

---

## 3. Repository structure

```
ShopKart/
├── backend/
│   ├── config/
│   │   ├── cookie.js              # auth-cookie name + options (set & clear)
│   │   ├── db.js                  # Mongoose connection + index creation
│   │   ├── env.js                 # env helpers & startup validation
│   │   └── razorpay.js            # lazy Razorpay client, key helpers, Test Mode warnings
│   ├── controllers/
│   │   ├── customer.controller.js # register, login, me, logout, change-password
│   │   ├── product.controller.js  # list (search/category) + details
│   │   ├── wishlist.controller.js # add, list (populated), remove, toggle
│   │   ├── cart.controller.js     # add/increment, list, set quantity, remove (stock-checked)
│   │   └── order.controller.js    # create-payment-order, verify-payment, orders, status demo
│   ├── data/products.js           # sample catalogue (Unsplash images)
│   ├── middlewares/
│   │   ├── auth.middleware.js     # protect(): cookie → JWT → req.user
│   │   └── error.middleware.js    # 404, DB-availability guard, error → JSON
│   ├── models/
│   │   ├── customer.model.js      # Customer (+ wishlist refs, cart items), bcrypt hook
│   │   ├── product.model.js
│   │   └── order.model.js         # items snapshot, shipping, payment + status fields
│   ├── routes/                    # customer, product, wishlist, cart, order routers
│   ├── scripts/
│   │   ├── localMongo.js          # `npm run db:local` — real local MongoDB
│   │   └── seed.js                # `npm run seed` — add sample products
│   ├── tests/
│   │   ├── helpers/               # isolated test DB + fixtures
│   │   ├── register / login / auth.middleware / profile-logout / change-password / app .test.js
│   │   └── products / wishlist / cart / orders .test.js
│   ├── utils/
│   │   ├── generateToken.js  httpError.js  validators.js
│   │   ├── objectId.js            # ObjectId validation → 400
│   │   ├── shippingAddress.js     # checkout address validation (Indian phone, 6-digit pincode)
│   │   └── seedProducts.js
│   ├── app.js                     # Express app factory (used by tests)
│   ├── index.js                   # entry point: env check → DB → listen
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
├── frontend/
│   ├── public/favicon.svg
│   ├── src/
│   │   ├── assets/shopping-illustration.svg
│   │   ├── components/
│   │   │   ├── Navbar.jsx  ProtectedRoute.jsx  GuestRoute.jsx
│   │   │   ├── AuthLayout.jsx  FormField.jsx  Alert.jsx  ChangePasswordForm.jsx
│   │   │   ├── Logo.jsx  Footer.jsx  Spinner.jsx  FullPageLoader.jsx  StateViews.jsx
│   │   │   ├── ProductCard.jsx  ProductImage.jsx  StockBadge.jsx
│   │   │   ├── WishlistButton.jsx  AddToCartButton.jsx  OrderSummary.jsx
│   │   │   └── OrderItems.jsx  StatusTimeline.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx       # session state sourced from GET /customers/me
│   │   │   └── CartContext.jsx       # global cart (useReducer): items, loading, error, actions
│   │   ├── hooks/                    # useWishlist, useSavedProducts, useOrder, useSessionCheck, useRequireLogin
│   │   ├── pages/
│   │   │   ├── Login  Register  Home  NotFound
│   │   │   ├── Products  ProductDetails  Wishlist  Cart
│   │   │   └── Checkout  OrderSuccess  Orders  OrderDetails
│   │   ├── services/api.js           # shared Axios instance (withCredentials) + all API calls
│   │   ├── utils/validation.js  format.js  loadRazorpay.js
│   │   ├── App.jsx  main.jsx  index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
├── package.json                    # npm workspaces + root scripts
├── package-lock.json
├── .gitignore
└── README.md
```

---

## 4. Prerequisites

- **Node.js 20.19+ or 22.12+** (developed and tested with Node 24.8) and **npm 10+**.
- **Git**.
- **A MongoDB database.** Any one of:
  - MongoDB Atlas (free tier is fine), or
  - a locally installed MongoDB Community Server, or
  - the bundled `npm run db:local` script, which downloads the official `mongod` binary on first run (~100 MB) and needs no installation.

---

## 5. Installation

```bash
git clone <your-repo-url> ShopKart
cd ShopKart
npm install          # installs root, backend and frontend dependencies (npm workspaces)
```

### Backend environment (`backend/.env`)

```bash
cp backend/.env.example backend/.env
```

Then fill in:

| Variable | Required | Example / notes |
|---|---|---|
| `PORT` | no | `5000` (default) |
| `MONGODB_URI` | **yes** | `mongodb://127.0.0.1:27017/shopkart` or an Atlas `mongodb+srv://…` URI |
| `JWT_SECRET` | **yes** | at least 32 random characters (see below) |
| `JWT_EXPIRES_IN_HOURS` | no | `24` (default); used for both the JWT `exp` and the cookie `Max-Age` |
| `FRONTEND_URL` | yes in production | exact frontend origin, e.g. `http://localhost:5173`; comma-separate several |
| `NODE_ENV` | no | `development` or `production` |
| `COOKIE_SAME_SITE` | no | `lax` (default), `strict` or `none` |
| `COOKIE_SECURE` | no | defaults to `true` in production, `false` otherwise |
| `COOKIE_DOMAIN` | no | e.g. `.example.com` when frontend and API share a parent domain |
| `TRUST_PROXY` | no | `1` when behind a reverse proxy or PaaS load balancer |
| `BCRYPT_SALT_ROUNDS` | no | `12` (default) |
| `RAZORPAY_KEY_ID` | for checkout | Test Mode Key ID, `rzp_test_…` (public; sent to the browser to open Checkout) |
| `RAZORPAY_KEY_SECRET` | for checkout | Test Mode Key Secret: **backend only**, never in the frontend, an API response or Git |
| `ENABLE_ORDER_STATUS_DEMO` | no | `true` to allow the order-status demo endpoint in production (on by default outside production) |

**Generate a JWT secret:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

The API refuses to start, with a clear message, if `MONGODB_URI` or `JWT_SECRET` is missing or the secret is too short. Without Razorpay keys the API still starts (browsing, wishlist and cart work), prints a warning, and `create-payment-order` returns **503** until keys are added. It also warns if the Key ID is a Live key (`rzp_live_…`).

### Razorpay Test Mode keys

1. Sign up or log in at <https://dashboard.razorpay.com>.
2. Switch the dashboard to **Test Mode** (toggle at the top).
3. **Account & Settings → API Keys → Generate Test Key**. Copy the Key ID and Key Secret.
4. Put them in `backend/.env` (this file is gitignored), then restart the API:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_test_key_secret
   ```

The frontend needs no Razorpay configuration: the Key ID comes from `create-payment-order`. In the Test Mode Checkout window, use Razorpay's published test credentials, such as a test card, a test UPI id like `success@razorpay`, or test netbanking. See <https://razorpay.com/docs/payments/payments/test-card-details/>. No real money moves in Test Mode.

### Frontend environment (`frontend/.env`)

```bash
cp frontend/.env.example frontend/.env
```

```
VITE_API_URL=http://localhost:5000
```

`VITE_*` variables are compiled into public JavaScript. Only ever put the public API URL here, never secrets.

---

## 6. Database setup

### Option A: MongoDB Atlas

1. Create a free cluster at <https://www.mongodb.com/atlas>.
2. **Database Access**: create a database user with a username and password.
3. **Network Access**: add your current IP address. `0.0.0.0/0` allows access from anywhere; only use it for short-lived testing.
4. **Connect → Drivers**: copy the URI and add a database name before the `?`:
   ```
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/shopkart?retryWrites=true&w=majority
   ```
   URL-encode special characters in the password (for example `@` → `%40`).

### Option B: locally installed MongoDB

Install MongoDB Community Server (on macOS: `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`), then:

```
MONGODB_URI=mongodb://127.0.0.1:27017/shopkart
```

### Option C: no install (`npm run db:local`)

```bash
npm run db:local     # keep this terminal open
```

This starts a real MongoDB server on `127.0.0.1:27017`. Data persists in `backend/.mongo-data/`, which is gitignored. Use `MONGODB_URI=mongodb://127.0.0.1:27017/shopkart`. To use a different port, set `LOCAL_MONGO_PORT=27018`.

The unique indexes on customer `email` and product `name` are created automatically when the API starts.

### Sample products

In development, the API adds 14 sample products the first time it starts with an empty `products` collection. You can also run:

```bash
npm run seed              # insert any missing sample products (keeps your edits)
npm run seed -- --reset   # restore sample products to their original price and stock
```

---

## 7. Running the app

```bash
npm run dev            # backend (http://localhost:5000) + frontend (http://localhost:5173)
```

Or run each part on its own:

```bash
npm run dev:backend    # API with auto-restart (node --watch)
npm run dev:frontend   # Vite dev server
npm start              # API without watch mode
```

Open **http://localhost:5173**. Expected startup output from the API:

```
[ShopKart] Connecting to MongoDB at mongodb://127.0.0.1:27017/shopkart ...
[ShopKart] MongoDB connected.
[ShopKart] Product catalogue was empty — added 14 sample products.   (first run only)
[ShopKart] API ready on http://localhost:5000 (development)
[ShopKart] Accepting browser requests from: http://localhost:5173
```

Credentials in the URI are stripped before logging. If MongoDB cannot be reached, the API exits instead of claiming to be ready.

## 8. Tests

```bash
npm test
```

Runs 109 backend tests. Each test file starts its own temporary in-memory MongoDB (`mongodb-memory-server`), so **your development or Atlas database is never touched**. The first run downloads the `mongod` binary and needs internet access. To use an existing server instead, set `TEST_MONGODB_URI`. The test helper refuses any database whose name does not contain `test`.

Coverage includes:

- **Registration:** success, missing, empty or whitespace-only fields, invalid email or phone, short or over-long passwords, duplicate email (any case), five concurrent duplicate requests, a forced E11000 race, bcrypt hash persisted, no password in the response, operator injection (`{"$gt": ""}`), malformed JSON, and a generic 500.
- **Login:** success, HttpOnly / Path / SameSite / Max-Age cookie attributes, JWT payload and expiry, unknown email, wrong password, identical generic error, missing credentials, injection.
- **Middleware:** missing cookie, malformed token, wrong-secret token, `alg: none` token, expired token, invalid subject, valid token, correct password-free `req.user`, deleted customer, client-supplied ids ignored.
- **Profile, logout and change password:** real record returned, 401 without a cookie, cookie cleared with matching attributes, access denied after logout, old tokens rejected after a password change.
- **App:** health check, JSON 404, CORS allow and deny, `x-powered-by` hidden, environment validation, production cookie flags, 503 when the DB is down.
- **Products:** list, count and categories; case-insensitive search; category filter; regex characters treated literally; details; 404 and 400; idempotent seeding.
- **Wishlist:** 401 on every route, add + populated list, 409 duplicate (also under 5 concurrent requests), 400 invalid id, 404 missing product, remove + 404 when absent, toggle, per-customer isolation, deleted products dropped, no `/wishlist/:userId` route.
- **Cart:** 401, add and increment without duplicate rows, stock limit on add (also under concurrency), out of stock, quantity validation (0, negative, decimal, string, missing), stock limit on update, 404 cases, remove returns the updated cart, deleted products dropped, per-customer isolation.
- **Orders and Razorpay** (Razorpay API mocked, never contacted):
  - The server computes the total from current product prices, and the paise amount sent to Razorpay matches it. A client `totalAmount` is ignored.
  - Checkout is blocked for an empty cart, for insufficient stock (by product name), and for an invalid shipping address. In those cases Razorpay is never called.
  - The Key Secret never appears in a response. If Razorpay fails, the API returns 502 and discards the pending order; without keys it returns 503.
  - A valid signature produces PAID/PLACED, stores the payment id, clears the cart and reduces stock.
  - An invalid signature, a client-side `paymentSuccess` flag, or a signature for a *different* Razorpay order is rejected, and the cart is kept.
  - Customers cannot verify or read another customer's order.
  - Verification is idempotent; a second, different payment returns 409. A failed payment keeps the cart and can still be retried.
  - Order lists are newest first and contain only paid orders.
  - The status demo moves forward only and is disabled in production.

## 9. Production build of the frontend

```bash
npm run build      # outputs frontend/dist
npm run preview    # serves the build on http://localhost:4173
```

If you use `preview` against a local API, add `http://localhost:4173` to `FRONTEND_URL` (comma-separated).

---

## 10. API reference

Base URL (local): `http://localhost:5000`. All bodies are JSON. Errors always have the shape `{ "success": false, "message": "…", "errors"?: { field: message } }`.

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/customers/register` | Public | Create a customer |
| POST | `/customers/login` | Public | Verify credentials, set auth cookie |
| GET | `/customers/me` | Cookie required | Current customer's profile |
| POST | `/customers/logout` | Cookie required | Clear auth cookie |
| PATCH | `/customers/change-password` | Cookie required | Change password, revoke older tokens |
| GET | `/products?search=&category=` | Public | `{ success, count, categories, products }` |
| GET | `/products/:id` | Public | `{ success, product }`; 400 invalid id, 404 missing |
| POST | `/wishlist/:productId` | Cookie required | Add (201); 400 invalid id, 404 no product, 409 duplicate |
| GET | `/wishlist` | Cookie required | `{ success, count, wishlist: [product…] }` (populated) |
| DELETE | `/wishlist/:productId` | Cookie required | Remove; 404 if not in wishlist |
| PATCH | `/wishlist/:productId/toggle` | Cookie required | Add or remove → `{ success, saved: true\|false }` |
| GET | `/cart` | Cookie required | `{ success, cart: [{ product, quantity }] }` (populated) |
| POST | `/cart/:productId` | Cookie required | Add 1 or increment; 400 if it would exceed stock |
| PATCH | `/cart/:productId` | Cookie required | Body `{ quantity }`: whole number, ≥ 1, ≤ stock; 404 if not in cart |
| DELETE | `/cart/:productId` | Cookie required | Remove line, returns the updated cart |
| POST | `/orders/create-payment-order` | Cookie required | Body `{ shippingAddress }` → `{ success, shopKartOrderId, razorpayOrderId, amount, currency, key }` |
| POST | `/orders/verify-payment` | Cookie required | Body `{ shopKartOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }` → `{ success, order }` |
| POST | `/orders/:id/payment-failed` | Cookie required | Record a failed attempt (cart untouched) |
| GET | `/orders` | Cookie required | Own paid orders, newest first (`?includeUnpaid=true` for all) |
| GET | `/orders/:id` | Cookie required | Own order; 404 for other customers' orders |
| PATCH | `/orders/:id/status` | Cookie required | Demo only: body `{ status }`, forward-only for paid orders |
| GET | `/health` | Public | Liveness + database status |

**Testing with Postman.** Authentication uses the `shopkart_token` HttpOnly cookie, not an `Authorization` header. Send `POST /customers/login` first: Postman's cookie jar stores the cookie for `localhost` and sends it automatically on later requests. To call the API from another tool, copy the `Set-Cookie` value into a `Cookie: shopkart_token=…` header. You can't complete a payment from Postman alone, because `verify-payment` needs a signature that only Razorpay Checkout produces.

### POST /customers/register

```json
{ "fullName": "John Doe", "email": "john@gmail.com", "password": "john123", "phone": "9876543210" }
```

**201 Created**

```json
{
  "success": true,
  "message": "Customer registered successfully",
  "customer": {
    "_id": "6acd3340187e2d3fef48f503",
    "fullName": "John Doe",
    "email": "john@gmail.com",
    "phone": "9876543210",
    "createdAt": "2026-10-12T19:21:36.751Z"
  }
}
```

| Status | When | Example message |
|---|---|---|
| 400 | missing, blank or invalid field; password < 6 characters or > 72 bytes | `"Password must be at least 6 characters"` + `errors.password` |
| 409 | email already registered | `"An account with this email already exists"` |
| 500 | unexpected failure | `"Something went wrong on our side. Please try again later."` |

The phone number may contain spaces, dashes or brackets, which are removed before saving. It must end up as 10–15 digits with an optional leading `+`.

### POST /customers/login

```json
{ "email": "john@gmail.com", "password": "john123" }
```

**200 OK.** The response also includes `Set-Cookie: shopkart_token=<jwt>; Max-Age=86400; Path=/; HttpOnly; SameSite=Lax`.

```json
{ "success": true, "message": "Login successful", "customer": { "_id": "…", "fullName": "John Doe", "email": "john@gmail.com", "phone": "9876543210", "createdAt": "…" } }
```

| Status | When | Message |
|---|---|---|
| 400 | email or password missing | `"Email is required"` / `"Password is required"` |
| 401 | unknown email **or** wrong password | `"Invalid Credentials"` |

### GET /customers/me

**200 OK**

```json
{ "_id": "…", "fullName": "John Doe", "email": "john@gmail.com", "phone": "9876543210", "createdAt": "…" }
```

**401** if the cookie is missing (`"You are not logged in. Please log in to continue."`), or if the token is invalid, expired, or belongs to a deleted customer (`"Your session is invalid or has expired. Please log in again."`). In the second case the stale cookie is also cleared.

### POST /customers/logout

**200 OK** with `Set-Cookie: shopkart_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`

```json
{ "success": true, "message": "Logged out successfully" }
```

Returns **401** if the session has already expired; the frontend treats that as "already logged out".

### PATCH /customers/change-password

```json
{ "oldPassword": "john123", "newPassword": "newSecret1" }
```

**200 OK.** A fresh cookie is issued, so this browser stays signed in.

```json
{ "success": true, "message": "Password changed successfully. Other sessions have been signed out." }
```

**400** for missing fields, a new password shorter than 6 characters, a new password equal to the old one, or a wrong current password (`errors.oldPassword`). **401** if not logged in.

### GET /health

`200 {"success":true,"status":"ok","database":"connected"}`, or `503` with `"database":"disconnected"`.

### Quick test with curl

```bash
curl -i -c jar.txt -H 'Content-Type: application/json' \
  -d '{"email":"john@gmail.com","password":"john123"}' http://localhost:5000/customers/login
curl -b jar.txt http://localhost:5000/customers/me
curl -b jar.txt -c jar.txt -X POST http://localhost:5000/customers/logout
```

---

## 11. How authentication works

1. On login, the server signs `{ sub: <customerId>, tv: <tokenVersion> }` with `JWT_SECRET` using HS256 and an expiry of `JWT_EXPIRES_IN_HOURS`.
2. The token is sent **only** as the `shopkart_token` cookie, with `HttpOnly` (JavaScript cannot read it), `Path=/`, `SameSite`, `Secure` in production, and a `Max-Age` equal to the token lifetime. It is never returned in a response body and never stored in `localStorage` or `sessionStorage`.
3. The frontend's Axios instance uses `withCredentials: true`, so the browser attaches the cookie to API calls.
4. `ProtectedRoute` calls `GET /customers/me` every time a protected page is mounted, including after a browser refresh. On the first check it shows a loader until the backend answers. After that, it re-checks in the background so moving between pages doesn't flash a loader:
   - **200**: render the page.
   - **401**: redirect to `/login`.
   - Network error or 5xx: show a "Try again" screen. The session is not treated as invalid.
5. Logout calls the API, which clears the cookie. The client then forgets the customer and navigates to `/login`.

**Limitations of stateless JWTs.** Logging out removes the cookie from *this* browser. It does not revoke a copy of the token that was already copied elsewhere; such a copy stays valid until it expires. Changing the password *does* revoke all earlier tokens: the customer's `tokenVersion` is incremented and the middleware rejects tokens carrying an older version. Revoking individual tokens on logout would need a server-side denylist or session store, which is outside this project's scope.

### Cookie settings: localhost vs deployment

| Setting | Local development (default) | Production |
|---|---|---|
| Origins | `http://localhost:5173` → `http://localhost:5000` | your HTTPS frontend → your HTTPS API |
| `NODE_ENV` | `development` | `production` |
| `Secure` | off (plain http) | on (automatic in production) |
| `SameSite` | `lax`: localhost:5173 and localhost:5000 are the *same site*, since ports are ignored | `lax` if frontend and API share a registrable domain (e.g. `app.example.com` + `api.example.com`); `none` only if they are on different sites |
| CORS | `FRONTEND_URL=http://localhost:5173` | `FRONTEND_URL=https://app.example.com` (exact origin, no trailing slash) |

**Use the same host name everywhere.** `localhost` and `127.0.0.1` are *different* sites. If you open the frontend at `http://127.0.0.1:5173` while `VITE_API_URL` points to `http://localhost:5000`, the cookie is not sent and CORS rejects the request.

### How checkout and payment verification work

1. **Checkout page.** The shipping form is validated in the browser: no blank fields, a 10-digit Indian mobile number, and a 6-digit pincode. If validation fails, nothing is sent to the backend.
2. **Load Razorpay.** `https://checkout.razorpay.com/v1/checkout.js` is loaded, with an error message if it's blocked or offline.
3. **Create the payment order.** The browser calls `POST /orders/create-payment-order` with **only the shipping address**. The server then:
   - re-reads the cart and current product prices and stock;
   - rejects empty carts and insufficient stock;
   - computes the total;
   - saves a `PENDING` order with a snapshot of each item (name, price, quantity, image);
   - creates a Razorpay order for `Math.round(total × 100)` paise.
4. **Pay.** Razorpay Checkout opens with the Key ID and the Razorpay order id. ShopKart never sees card or UPI details.
5. **Verify.** On success, Checkout gives the browser `razorpay_payment_id` and `razorpay_signature`, which are posted to `POST /orders/verify-payment`. The server computes `HMAC_SHA256(razorpayOrderId + "|" + paymentId, RAZORPAY_KEY_SECRET)`, using the Razorpay order id **stored on the ShopKart order**. It compares the result in constant time. Only a match marks the order **PAID / PLACED**, stores the payment id, reduces stock and removes the purchased items from the cart.
6. **Finish.** The frontend clears the global cart state (navbar shows `Cart (0)`) and goes to `/order-success/:id`.
7. **On failure.** If the payment fails, the order is marked `FAILED` and the cart stays as it was ("Payment failed. Your cart has not been cleared."). If the customer closes Checkout, the cart stays too.

---

## 12. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Cannot start — configuration problems in backend/.env` | Create `backend/.env` from `.env.example`, then set `MONGODB_URI` and a 32+ character `JWT_SECRET`. |
| `MongoDB connection failed: connect ECONNREFUSED 127.0.0.1:27017` | MongoDB isn't running. Start your local MongoDB or run `npm run db:local`. |
| `MongoDB connection failed: … bad auth` / `querySrv ENOTFOUND` | Wrong Atlas username/password (URL-encode special characters) or a mistyped cluster host. |
| Atlas times out after ~10 s | Your IP isn't in Atlas **Network Access**. |
| `Port 5000 is already in use` | Another process is using the port. **On macOS, port 5000 is used by "AirPlay Receiver"**: turn it off in *System Settings → General → AirDrop & Handoff*, or set e.g. `PORT=5050` in `backend/.env` **and** `VITE_API_URL=http://localhost:5050` in `frontend/.env`. |
| `Port 5173 is already in use` | Stop the other Vite server. The port is fixed (`strictPort`) because it must match `FRONTEND_URL`. You can also run `npx vite --port 5174` from `frontend/` and add `http://localhost:5174` to `FRONTEND_URL`. |
| "Unable to reach the ShopKart server" in the browser | API not running, wrong `VITE_API_URL`, or a CORS rejection because `FRONTEND_URL` doesn't exactly match the page origin. Restart Vite after editing `frontend/.env`. |
| Login succeeds but `/home` redirects back to `/login` | The browser didn't store or send the cookie. Use the same host name for both apps (see section 11). In production check HTTPS, `SameSite`, and `Secure`. |
| `npm test` fails to download MongoDB | The first run needs internet access to fetch the `mongod` binary. Alternatively set `TEST_MONGODB_URI=mongodb://127.0.0.1:27017/shopkart_test`. |
| Checkout says "Online payments are not configured yet" | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are missing from `backend/.env`. Add Test Mode keys and restart the API. |
| Checkout says "Could not start the payment with Razorpay" | Razorpay rejected the request, usually because of a wrong or mismatched Key ID and Secret. Regenerate the Test Mode keys and check for stray spaces. |
| "Could not load Razorpay Checkout" | The browser couldn't download `checkout.razorpay.com`. Check your connection and disable ad or tracker blockers for the site. |
| Products page is empty | Run `npm run seed` (auto-seeding only happens in development on an empty collection). |
| `bcrypt` install errors | Use a supported Node version (20.19+/22.12+). bcrypt ships prebuilt binaries for common platforms. |

---

## 13. Submitting on GitHub

The project is a local Git repository (branch `main`) with an initial commit. `.env` files, `node_modules/`, `dist/` and local MongoDB data are gitignored, and only the `.env.example` templates are committed.

```bash
git status                       # confirm no .env or node_modules are listed
git add -A && git commit -m "Describe your change"   # only if you changed something
# create an empty repository on github.com (no README/licence), then:
git remote add origin https://github.com/<your-username>/ShopKart.git
git branch -M main
git push -u origin main
```

Before pushing, double-check that `git ls-files | grep .env` prints only the two `.env.example` files.

---

## 14. Deployment (optional, not performed)

The project is deployment-ready, but **it has not been deployed**: no hosting credentials were available. For a typical setup, with the API on a Node host (Render, Railway, a VPS…) and the frontend on a static host (Vercel, Netlify…):

**API service**: root directory `backend`, build `npm install`, start `npm start`. Environment:

```
NODE_ENV=production
MONGODB_URI=<Atlas URI>
JWT_SECRET=<new 64-byte random hex — never reuse the dev secret>
FRONTEND_URL=https://<your-frontend-domain>
TRUST_PROXY=1
RAZORPAY_KEY_ID=rzp_test_…        # Test Mode only for this project
RAZORPAY_KEY_SECRET=<test secret> # set in the host's secret settings, never in Git
COOKIE_SAME_SITE=lax      # if frontend and API share a parent domain (recommended)
# COOKIE_SAME_SITE=none   # only if they are on different sites (forces Secure)
```

In Atlas Network Access, allow the host's outbound IPs.

**Frontend**: root directory `frontend`, build `npm run build`, publish `dist`. Set `VITE_API_URL=https://<your-api-domain>` *before* building. Configure the static host to rewrite all paths to `/index.html` so refreshing routes like `/home` or `/orders/:id` works.

**Cross-site cookies:** if the frontend and API live on unrelated domains (e.g. `*.vercel.app` and `*.onrender.com`), the auth cookie is a *third-party* cookie. Safari and some Chrome configurations block those even with `SameSite=None; Secure`. The reliable options are a custom domain for both (`app.example.com` + `api.example.com`, `SameSite=Lax`), or proxying the API routes (`/customers`, `/products`, `/wishlist`, `/cart`, `/orders`) through the frontend host so the API is same-origin. Verify login → `/home` → logout in the deployed environment before relying on it.

---

## 15. Known limitations

- Logout clears the cookie but does not revoke copies of the JWT made elsewhere (see section 11). Password changes do revoke all older tokens.
- There's no rate limiting on login or registration; add a limiter such as `express-rate-limit` before real-world use.
- Email addresses aren't verified, and there's no "forgot password" flow.
- Stock is checked when checkout starts and decremented after payment verification, but it isn't *reserved* during payment. Two customers paying for the last unit at the same moment can both succeed; stock is then clamped at 0 rather than going negative. A production store would reserve stock with an expiry, or refund automatically.
- Payment confirmation relies on the browser calling `verify-payment`. If the customer closes the tab right after paying, the order stays `PENDING` even though Razorpay captured the money. A production setup would also handle Razorpay **webhooks** (`payment.captured`), which need a public URL.
- There's no admin panel: products are managed through the seed data. The order-status endpoint is a demo that lets the order's owner advance it.
- Delivery is free and there are no taxes or coupons; the order total is the sum of item prices.
