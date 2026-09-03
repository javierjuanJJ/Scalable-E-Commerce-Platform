import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth.js';
import { authController } from '../controllers/auth.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { bruteForce } from '../middlewares/bruteForce.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);

router.post('/login', rateLimit({ max: 10, windowMs: 60000 }), bruteForce, validate(loginSchema), authController.login);

router.post('/logout', requireAuth, authController.logout);

router.get('/me', requireAuth, authController.getMe);

router.post('/forgot-password', rateLimit({ max: 3, windowMs: 3600000 }), validate(forgotPasswordSchema), authController.forgotPassword);

router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

export default router;