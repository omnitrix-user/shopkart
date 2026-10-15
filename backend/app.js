import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import customerRoutes from './routes/customer.routes.js';
import productRoutes from './routes/product.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js';
import { errorHandler, notFound, requireDatabase } from './middlewares/error.middleware.js';
import { getAllowedOrigins, shouldServeFrontend } from './config/env.js';
import { isDatabaseConnected } from './config/db.js';

const FRONTEND_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend/dist');

const isSameOrigin = (origin, req) => {
  try {
    return new URL(origin).host === req.get('host');
  } catch {
    return false;
  }
};

export function createApp() {
  const app = express();
  const serveFrontend = shouldServeFrontend();

  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  }

  const allowedOrigins = getAllowedOrigins();
  app.use(
    cors((req, callback) =>
      callback(null, {
        origin: (origin, done) =>
          done(null, !origin || allowedOrigins.includes(origin) || (serveFrontend && isSameOrigin(origin, req))),
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type'],
      }),
    ),
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  const health = (_req, res) => {
    const connected = isDatabaseConnected();
    res.status(connected ? 200 : 503).json({
      success: connected,
      status: connected ? 'ok' : 'degraded',
      database: connected ? 'connected' : 'disconnected',
    });
  };

  // When the API also serves the React app, API routes live under /api so they can't
  // collide with page URLs such as /products or /cart.
  const prefixes = serveFrontend ? ['/api'] : ['', '/api'];
  for (const prefix of prefixes) {
    app.get(`${prefix}/health`, health);
    app.use(`${prefix}/customers`, requireDatabase, customerRoutes);
    app.use(`${prefix}/products`, requireDatabase, productRoutes);
    app.use(`${prefix}/wishlist`, requireDatabase, wishlistRoutes);
    app.use(`${prefix}/cart`, requireDatabase, cartRoutes);
    app.use(`${prefix}/orders`, requireDatabase, orderRoutes);
  }

  if (serveFrontend) {
    app.use(
      '/assets',
      express.static(path.join(FRONTEND_DIST, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }),
    );
    app.use(express.static(FRONTEND_DIST, { index: false }));
    app.use((req, res, next) => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api')) return next();
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
