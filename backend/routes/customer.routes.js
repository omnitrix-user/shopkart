import { Router } from 'express';
import {
  changePassword,
  getCurrentCustomer,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
} from '../controllers/customer.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', registerCustomer);
router.post('/login', loginCustomer);
router.get('/me', protect, getCurrentCustomer);
router.post('/logout', protect, logoutCustomer);
router.patch('/change-password', protect, changePassword);

export default router;
