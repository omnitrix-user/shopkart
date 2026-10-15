import { Router } from 'express';
import {
  createPaymentOrder,
  getMyOrders,
  getOrderById,
  markPaymentFailed,
  updateOrderStatus,
  verifyPayment,
} from '../controllers/order.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

router.post('/create-payment-order', createPaymentOrder);
router.post('/verify-payment', verifyPayment);
router.get('/', getMyOrders);
router.get('/:id', getOrderById);
router.post('/:id/payment-failed', markPaymentFailed);
router.patch('/:id/status', updateOrderStatus);

export default router;
