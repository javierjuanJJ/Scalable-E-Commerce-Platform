import { userModel } from '../models/user.js';
import { auth } from '../lib/auth.js';
import { logger } from '../lib/logger.js';

export const userController = {
  async getMe(req, res) {
    try {
      const user = req.user;
      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            emailVerified: user.emailVerified,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
          },
        },
      });
    } catch (error) {
      logger.error({ error }, 'Get me error');
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user',
      });
    }
  },

  async updateMe(req, res) {
    try {
      const userId = req.user.id;
      const { name, avatarUrl } = req.validated;

      const updatedUser = await userModel.update(userId, { name, avatarUrl });
      if (!updatedUser) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      logger.info({ userId, changes: req.validated }, 'User profile updated');
      return res.status(200).json({
        success: true,
        data: { user: updatedUser },
      });
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, 'Update me error');
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to update profile',
      });
    }
  },

  async deleteMe(req, res) {
    try {
      const userId = req.user.id;
      const { password } = req.validated;

      const userWithPassword = await userModel.findByIdWithPassword(userId);
      if (!userWithPassword) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const isValid = await auth.api.verifyPassword({
        body: { password, passwordHash: userWithPassword.passwordHash },
      });

      if (!isValid) {
        logger.warn({ userId }, 'Invalid password for account deletion');
        return res.status(401).json({
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid password',
        });
      }

      const deleted = await userModel.delete(userId);
      if (!deleted) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      await auth.api.revokeUserSessions({ userId });

      logger.info({ userId }, 'User account deleted');
      return res.status(200).json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error) {
      logger.error({ error, userId: req.user?.id }, 'Delete me error');
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete account',
      });
    }
  },

  async listUsers(req, res) {
    try {
      const { page, limit, search, role, sortBy, sortOrder } = req.validatedQuery;
      const result = await userModel.findAll({ page, limit, search, role, sortBy, sortOrder });
      return res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      logger.error({ error }, 'List users error');
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to list users',
      });
    }
  },

  async getUser(req, res) {
    try {
      const { id } = req.validatedParams;
      const user = await userModel.findById(id);
      if (!user) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      return res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      logger.error({ error, userId: req.validatedParams?.id }, 'Get user error');
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user',
      });
    }
  },

  async updateUser(req, res) {
    try {
      const { id } = req.validatedParams;
      const { name, role, emailVerified } = req.validated;

      const user = await userModel.findById(id);
      if (!user) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const updatedUser = await userModel.update(id, { name, role, emailVerified });
      logger.info({ adminId: req.user.id, targetUserId: id, changes: req.validated }, 'Admin updated user');
      return res.status(200).json({
        success: true,
        data: { user: updatedUser },
      });
    } catch (error) {
      logger.error({ error, userId: req.validatedParams?.id }, 'Update user error');
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to update user',
      });
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.validatedParams;

      const user = await userModel.findById(id);
      if (!user) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      if (id === req.user.id) {
        return res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'Cannot delete your own account via admin endpoint',
        });
      }

      const deleted = await userModel.delete(id);
      if (!deleted) {
        return res.status(404).json({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      await auth.api.revokeUserSessions({ userId: id });

      logger.info({ adminId: req.user.id, targetUserId: id }, 'Admin deleted user');
      return res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      logger.error({ error, userId: req.validatedParams?.id }, 'Delete user error');
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete user',
      });
    }
  },
};