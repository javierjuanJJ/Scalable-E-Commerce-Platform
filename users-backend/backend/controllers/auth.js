import { auth } from '../lib/auth.js';
import { logger } from '../lib/logger.js';

export const authController = {
  async register(req, res) {
    try {
      const { email, password, name } = req.validated;
      const result = await auth.api.signUpEmail({
        body: { email, password, name },
        headers: req.headers,
      });

      if (result.error) {
        const statusCode = result.error.code === 'EMAIL_ALREADY_EXISTS' ? 409 : 400;
        logger.warn({ email, error: result.error }, 'Registration failed');
        return res.status(statusCode).json({
          code: result.error.code,
          message: result.error.message,
        });
      }

      logger.info({ userId: result.user.id, email }, 'User registered successfully');
      return res.status(201).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
            emailVerified: result.user.emailVerified,
            createdAt: result.user.createdAt,
          },
        },
      });
    } catch (error) {
      logger.error({ error, email: req.validated?.email }, 'Registration error');
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Registration failed',
      });
    }
  },

  async login(req, res) {
    try {
      const { email, password, rememberMe } = req.validated;
      const result = await auth.api.signInEmail({
        body: { email, password, rememberMe },
        headers: req.headers,
      });

      if (result.error) {
        logger.warn({ email, error: result.error }, 'Login failed');
        return res.status(401).json({
          code: result.error.code,
          message: result.error.message,
        });
      }

      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : undefined,
      };

      res.cookie('session', result.session.token, cookieOptions);

      logger.info({ userId: result.user.id, email }, 'User logged in successfully');
      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
            emailVerified: result.user.emailVerified,
          },
          session: {
            token: result.session.token,
            expiresAt: result.session.expiresAt,
          },
        },
      });
    } catch (error) {
      logger.error({ error, email: req.validated?.email }, 'Login error');
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Login failed',
      });
    }
  },

  async logout(req, res) {
    try {
      const sessionToken = req.cookies?.session;
      if (sessionToken) {
        await auth.api.signOut({
          headers: req.headers,
        });
      }

      res.clearCookie('session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      logger.info({ userId: req.user?.id }, 'User logged out');
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Logout error');
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    }
  },

  async getMe(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          code: 'UNAUTHENTICATED',
          message: 'Authentication required',
        });
      }

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

  async forgotPassword(req, res) {
    try {
      const { email } = req.validated;
      await auth.api.forgetPassword({
        body: { email },
        headers: req.headers,
      });

      const hashedEmail = email.substring(0, 2) + '***' + email.substring(email.indexOf('@'));
      logger.info({ email: hashedEmail }, 'Password reset requested');

      return res.status(200).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      });
    } catch (error) {
      logger.error({ error, email: req.validated?.email }, 'Forgot password error');
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to process request',
      });
    }
  },

  async resetPassword(req, res) {
    try {
      const { token, password } = req.validated;
      const result = await auth.api.resetPassword({
        body: { token, password },
        headers: req.headers,
      });

      if (result.error) {
        logger.warn({ error: result.error }, 'Password reset failed');
        return res.status(400).json({
          code: result.error.code,
          message: result.error.message,
        });
      }

      logger.info({ userId: result.user.id }, 'Password reset successful');
      return res.status(200).json({
        success: true,
        message: 'Password has been reset successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Reset password error');
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to reset password',
      });
    }
  },
};