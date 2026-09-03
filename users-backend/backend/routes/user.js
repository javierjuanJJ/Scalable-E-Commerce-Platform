import { Router } from 'express';
import { z } from 'zod';
import { validate, validateQuery, validateParams } from '../middlewares/validate.js';
import { profileUpdateSchema, adminUpdateSchema, deleteConfirmationSchema, paginationSchema } from '../schemas/user.js';
import { userController } from '../controllers/user.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

const router = Router();

const idParamSchema = z.object({ id: z.string().uuid() });

router.get('/me', requireAuth, userController.getMe);
router.patch('/me', requireAuth, validate(profileUpdateSchema), userController.updateMe);
router.delete('/me', requireAuth, validate(deleteConfirmationSchema), userController.deleteMe);

router.get('/', requireAuth, requireAdmin, validateQuery(paginationSchema), userController.listUsers);
router.get('/:id', requireAuth, requireAdmin, validateParams(idParamSchema), userController.getUser);
router.patch('/:id', requireAuth, requireAdmin, validateParams(idParamSchema), validate(adminUpdateSchema), userController.updateUser);
router.delete('/:id', requireAuth, requireAdmin, validateParams(idParamSchema), userController.deleteUser);

export default router;