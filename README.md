# ShopKart

ShopKart is a full-stack customer authentication app for a fictional online store. Customers can register, log in, view their own profile on a protected home page, change their password, and log out.

- **Backend:** Node.js, Express 5, MongoDB with Mongoose, bcrypt password hashing, and JWTs stored in an HttpOnly cookie. Structured as MVC (models, controllers, routes, middlewares, utils).
- **Frontend:** React 19 with Vite, React Router, and Axios. Styled with plain CSS: a custom design system, fully responsive.
- **Tests:** 62 automated backend tests (Node's built-in test runner + Supertest) against an isolated, throw-away MongoDB instance.

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
| Frontend | `/register`, `/login`, and a protected `/home`. `/` redirects; unknown URLs show a 404 page. Inline validation, loading states, backend error display, retry on network or server errors, and a responsive layout from 320 px to desktop. |

Password hashes are never returned by any endpoint, and passwords, tokens and secrets are never logged.

---

## 2. Technology stack

| Layer | Packages |
|---|---|
| Backend | `express` 5, `mongoose` 9, `bcrypt` 6, `jsonwebtoken` 9, `cookie-parser`, `cors`, `dotenv` |
| Backend dev/test | Node's built-in `node:test` and `--watch`, `supertest`, `mongodb-memory-server` |
| Frontend | `react` 19, `react-dom`, `react-router-dom` 7, `axios`, `vite` 8, `@vitejs/plugin-react` |
| Tooling | npm workspaces, `concurrently` |

No authentication frameworks (Passport, Firebase, Auth0, Clerk), no Redux, and no UI kits are used.

---

## 3. Repository structure

```
ShopKart/
├── backend/
│   ├── config/
│   │   ├── cookie.js              # auth-cookie name + options (set & clear)
│   │   ├── db.js                  # Mongoose connection + index creation
│   │   └── env.js                 # env helpers & startup validation
│   ├── controllers/
│   │   └── customer.controller.js # register, login, me, logout, change-password
│   ├── middlewares/
│   │   ├── auth.middleware.js     # protect(): cookie → JWT → req.user
│   │   └── error.middleware.js    # 404, DB-availability guard, error → JSON
│   ├── models/
│   │   └── customer.model.js      # Customer schema, bcrypt pre-save hook
│   ├── routes/
│   │   └── customer.routes.js
│   ├── scripts/
│   │   └── localMongo.js          # `npm run db:local` — real local MongoDB
│   ├── tests/
│   │   ├── helpers/               # isolated test DB + fixtures
│   │   ├── register.test.js
│   │   ├── login.test.js
│   │   ├── auth.middleware.test.js
│   │   ├── profile-logout.test.js
│   │   ├── change-password.test.js
│   │   └── app.test.js
│   ├── utils/
│   │   ├── generateToken.js
│   │   ├── httpError.js
│   │   └── validators.js
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
│   │   │   └── Logo.jsx  Footer.jsx  Spinner.jsx  FullPageLoader.jsx
│   │   ├── context/AuthContext.jsx   # session state sourced from GET /customers/me
│   │   ├── pages/  Login.jsx  Register.jsx  Home.jsx  NotFound.jsx
│   │   ├── services/api.js           # shared Axios instance (withCredentials)
│   │   ├── utils/validation.js
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

**Generate a JWT secret:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

The API refuses to start, with a clear message, if `MONGODB_URI` or `JWT_SECRET` is missing or the secret is too short.

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

The unique index on `email` is created automatically when the API starts.

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
[ShopKart] API ready on http://localhost:5000 (development)
[ShopKart] Accepting browser requests from: http://localhost:5173
```

Credentials in the URI are stripped before logging. If MongoDB cannot be reached, the API exits instead of claiming to be ready.

## 8. Tests

```bash
npm test
```

Runs 62 backend tests. Each test file starts its own temporary in-memory MongoDB (`mongodb-memory-server`), so **your development or Atlas database is never touched**. The first run downloads the `mongod` binary and needs internet access. To use an existing server instead, set `TEST_MONGODB_URI`. The test helper refuses any database whose name does not contain `test`.

Coverage includes:

- **Registration:** success, missing, empty or whitespace-only fields, invalid email or phone, short or over-long passwords, duplicate email (any case), five concurrent duplicate requests, a forced E11000 race, bcrypt hash persisted, no password in the response, operator injection (`{"$gt": ""}`), malformed JSON, and a generic 500.
- **Login:** success, HttpOnly / Path / SameSite / Max-Age cookie attributes, JWT payload and expiry, unknown email, wrong password, identical generic error, missing credentials, injection.
- **Middleware:** missing cookie, malformed token, wrong-secret token, `alg: none` token, expired token, invalid subject, valid token, correct password-free `req.user`, deleted customer, client-supplied ids ignored.
- **Profile, logout and change password:** real record returned, 401 without a cookie, cookie cleared with matching attributes, access denied after logout, old tokens rejected after a password change.
- **App:** health check, JSON 404, CORS allow and deny, `x-powered-by` hidden, environment validation, production cookie flags, 503 when the DB is down.

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
| GET | `/health` | Public | Liveness + database status |

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
4. `ProtectedRoute` calls `GET /customers/me` every time `/home` is mounted, including after a browser refresh. It shows a loader until the backend answers:
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
COOKIE_SAME_SITE=lax      # if frontend and API share a parent domain (recommended)
# COOKIE_SAME_SITE=none   # only if they are on different sites (forces Secure)
```

In Atlas Network Access, allow the host's outbound IPs.

**Frontend**: root directory `frontend`, build `npm run build`, publish `dist`. Set `VITE_API_URL=https://<your-api-domain>` *before* building. Configure the static host to rewrite all paths to `/index.html` so refreshing `/home` works.

**Cross-site cookies:** if the frontend and API live on unrelated domains (e.g. `*.vercel.app` and `*.onrender.com`), the auth cookie is a *third-party* cookie. Safari and some Chrome configurations block those even with `SameSite=None; Secure`. The reliable options are a custom domain for both (`app.example.com` + `api.example.com`, `SameSite=Lax`), or proxying `/customers/*` through the frontend host so the API is same-origin. Verify login → `/home` → logout in the deployed environment before relying on it.

---

## 15. Known limitations

- Logout clears the cookie but does not revoke copies of the JWT made elsewhere (see section 11). Password changes do revoke all older tokens.
- There's no rate limiting on login or registration; add a limiter such as `express-rate-limit` before real-world use.
- Email addresses aren't verified, and there's no "forgot password" flow.
- The store front-end (catalogue, cart, orders, payments) is intentionally out of scope for this lab.
