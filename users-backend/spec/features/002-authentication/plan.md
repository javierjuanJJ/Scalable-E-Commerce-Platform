# Implementation Plan: Authentication

## Overview

**Feature**: 002-authentication  
**Depends On**: 001-registration (Better Auth configured, user model exists)

## Architecture Decisions

### 1. Better Auth Session Handling
- Better Auth manages session creation, validation, revocation
- Session stored in JSON (MVP) / PostgreSQL (production) via adapter
- Cookie-based sessions (not JWT in localStorage) for XSS protection

### 2. Express Middleware Chain
```
Request
  → CORS
  → Body Parser
  → Request Logger (Pino)
  → Better Auth Session Middleware (attaches req.user, req.session)
  → Route Handler
  → Response
```

### 3. Protected Route Pattern
```javascript
// middleware/requireAuth.js
export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      code: 'UNAUTHENTICATED', 
      message: 'Authentication required' 
    });
  }
  next();
};
```

### 4. Rate Limiting
- `express-rate-limit` middleware
- Login: 10 req/min/IP
- Register: 5 req/min/IP
- Password reset: 3 req/hour/IP

### 5. Brute Force Protection
- Track failed attempts in memory (Redis in production)
- Lock after 5 failures for 15 minutes
- Log security events separately

## Better Auth Configuration Additions

```typescript
// lib/auth.js (extends from feature 001)
export const auth = betterAuth({
  // ... existing config
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24, // 24 hours
    },
  },
  // Rate limiting handled at Express level
  // Brute force: custom middleware
  
  // Password reset
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === 'production',
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false,
    sendResetPassword: async ({ user, url, token }) => {
      // Email provider integration
      logger.info({ userId: user.id, email: user.email }, 'Password reset email queued');
    },
    resetPasswordTokenExpiresIn: 3600, // 1 hour
  },
});
```

## Data Flow

### Login Flow
```
POST /login
  → validate(loginSchema)
  → betterAuth.api.signInEmail(email, password)
  → Better Auth creates session, sets cookie
  → Controller returns user + session info
  → Log success
```

### Protected Route Flow
```
GET /me
  → requireAuth middleware
  → req.user attached by Better Auth middleware
  → Controller returns req.user
```

### Logout Flow
```
POST /logout
  → requireAuth middleware
  → betterAuth.api.signOut(sessionToken)
  → Clear cookie
  → Log logout
```

## Error Handling

| Scenario | HTTP Status | Code |
|----------|-------------|------|
| Invalid credentials | 401 | INVALID_CREDENTIALS |
| Email not verified | 403 | EMAIL_NOT_VERIFIED |
| No session | 401 | UNAUTHENTICATED |
| Session expired | 401 | SESSION_EXPIRED |
| Rate limited | 429 | RATE_LIMITED |
| Brute force locked | 403 | ACCOUNT_LOCKED |
| Invalid reset token | 400 | INVALID_RESET_TOKEN |
| Reset token expired | 400 | RESET_TOKEN_EXPIRED |

## Testing Strategy

### Integration Tests (extends app.test.js)
1. **Login Success**: Valid credentials → 200, cookie set, user returned
2. **Login Failure**: Wrong password → 401, INVALID_CREDENTIALS
3. **Login Unverified**: Unverified email → 403, EMAIL_NOT_VERIFIED (prod)
4. **Remember Me**: rememberMe=true → cookie maxAge 30 days
5. **Get Me Authenticated**: With session → 200, user data
6. **Get Me Unauthenticated**: No session → 401, UNAUTHENTICATED
7. **Logout**: With session → 200, cookie cleared
8. **Logout Idempotent**: Without session → 200
9. **Forgot Password**: Registered email → 200, email sent/logged
10. **Forgot Password Unregistered**: Unregistered email → 200 (no enumeration)
11. **Reset Password**: Valid token → 200, password updated, sessions revoked
12. **Reset Password Invalid**: Bad token → 400, INVALID_RESET_TOKEN
13. **Rate Limited**: Exceed login attempts → 429
14. **Brute Force Lock**: 5 failures → 403 for 15 min

### Security Tests
- Cookie attributes verified (HttpOnly, Secure, SameSite)
- Password never in logs or responses
- Reset token not exposed in logs
- Session revoked on password reset

## File Structure Impact

```
backend/
├── middlewares/
│   ├── requireAuth.js       # Auth guard
│   ├── rateLimit.js         # Rate limiting
│   └── bruteForce.js        # Failed attempt tracking
├── controllers/
│   └── auth.js              # login, logout, me, forgot, reset
├── routes/
│   └── auth.js              # All auth routes
├── lib/
│   ├── auth.js              # Better Auth config (extended)
│   └── logger.js            # Pino with security child logger
└── test/
    └── auth.test.js         # Additional auth tests
```

## Migration Considerations

- Session storage adapter same as user model (JSON → Prisma)
- Better Auth handles schema migrations for sessions
- No breaking changes to existing registration flow

## Configuration

```env
# Session
SESSION_COOKIE_NAME=__session
SESSION_MAX_AGE=86400000        # 24 hours (ms)
SESSION_REMEMBER_MAX_AGE=2592000000  # 30 days (ms)

# Rate Limiting
RATE_LIMIT_LOGIN_MAX=10
RATE_LIMIT_LOGIN_WINDOW_MS=60000
RATE_LIMIT_REGISTER_MAX=5
RATE_LIMIT_REGISTER_WINDOW_MS=60000

# Brute Force
BRUTE_FORCE_MAX_ATTEMPTS=5
BRUTE_FORCE_LOCKOUT_MS=900000   # 15 minutes

# Password Reset
RESET_TOKEN_EXPIRY_SECONDS=3600
```

## Rollback Plan

If Better Auth session issues:
1. Implement custom session middleware with signed cookies
2. Use `jsonwebtoken` for stateless access tokens + refresh tokens
3. Estimated effort: 2 days