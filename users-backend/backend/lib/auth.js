import { betterAuth } from 'better-auth';
import { emailAndPassword } from 'better-auth/plugins';
import { jsonAdapter } from '../adapters/json-adapter.js';

export const auth = betterAuth({
  database: jsonAdapter,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === 'production',
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false,
    sendResetPassword: async ({ user, url, token }, request) => {
      console.log(`Password reset email would be sent to ${user.email}: ${url}`);
    },
    sendVerificationEmail: async ({ user, url, token }, request) => {
      console.log(`Verification email would be sent to ${user.email}: ${url}`);
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
    defaultCookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  },
  plugins: [
    emailAndPassword(),
  ],
});

export type AuthType = typeof auth;