import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import customerRoutes from './routes/customer.routes.js';
import productRoutes from './routes/product.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js';
import { errorHandler, notFound, requireDatabase } from './middlewares/error.middleware.js';
import { getAllowedOrigins } from './config/env.js';
import { isDatabaseConnected } from './config/db.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  }

  app.use(
    cors({
      origin: getAllowedOrigins(),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type'],
    }),
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    const connected = isDatabaseConnected();
    res.status(connected ? 200 : 503).json({
      success: connected,
      status: connected ? 'ok' : 'degraded',
      database: connected ? 'connected' : 'disconnected',
    });
  });

  app.use('/customers', requireDatabase, customerRoutes);
  app.use('/products', requireDatabase, productRoutes);
  app.use('/wishlist', requireDatabase, wishlistRoutes);
  app.use('/cart', requireDatabase, cartRoutes);
  app.use('/orders', requireDatabase, orderRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
