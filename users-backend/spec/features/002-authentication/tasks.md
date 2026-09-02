# Tasks: Authentication

## Overview

**Feature**: 002-authentication  
**Depends On**: 001-registration (complete)

## Task Breakdown

### 1. Better Auth Session Configuration

- [ ] 1.1 Extend Better Auth config for sessions (`backend/lib/auth.js`)
  - Configure session cookie options (HttpOnly, Secure, SameSite)
  - Set cookie cache TTL
  - Configure password reset email callback
  - Set reset token expiry (1 hour)
  - **Verification**: Config validates, TypeScript compiles

- [ ] 1.2 Implement JSON session adapter (`backend/adapters/json-session-adapter.js`)
  - `createSession(userId, token, expiresAt)`
  - `getSession(token)`
  - `deleteSession(token)`
  - `deleteUserSessions(userId)` - for password reset
  - Atomic file operations on `data/sessions.json`
  - **Verification**: Unit tests pass

### 2. Validation Schemas

- [ ] 2.1 Extend auth schemas (`backend/schemas/auth.js`)
  - `loginSchema`: email, password, rememberMe
  - `forgotPasswordSchema`: email
  - `resetPasswordSchema`: token, password, confirmPassword
  - **Verification**: Zod validation works for all schemas

### 3. Security Middleware

- [ ] 3.1 Create rate limiting middleware (`backend/middlewares/rateLimit.js`)
  - Generic factory: `createRateLimit({ max, windowMs, keyGenerator })`
  - Login limiter: 10 req/min by IP
  - Register limiter: 5 req/min by IP
  - Password reset limiter: 3 req/hour by IP
  - **Verification**: Integration test exceeds limit → 429

- [ ] 3.2 Create brute force protection (`backend/middlewares/bruteForce.js`)
  - In-memory store (Map) tracking failures by IP+email
  - Lock after 5 failures for 15 minutes
  - Separate security logger for audit trail
  - **Verification**: 5 failed logins → 403 for 15 min

- [ ] 3.3 Create requireAuth middleware (`backend/middlewares/requireAuth.js`)
  - Checks `req.user` attached by Better Auth
  - Returns 401 with `UNAUTHENTICATED` code
  - **Verification**: Protected route without session → 401

### 4. Auth Controller Extensions

- [ ] 4.1 Add login handler (`backend/controllers/auth.js`)
  - `login(req, res)`: calls `betterAuth.api.signInEmail`
  - Handles rememberMe cookie maxAge
  - Maps Better Auth errors to HTTP responses
  - Logs success/failure with security context
  - **Verification**: Integration tests pass

- [ ] 4.2 Add logout handler
  - `logout(req, res)`: calls `betterAuth.api.signOut`
  - Clears session cookie
  - Idempotent (no error if no session)
  - Logs logout event
  - **Verification**: Integration tests pass

- [ ] 4.3 Add getMe handler
  - `getMe(req, res)`: returns `req.user` (attached by middleware)
  - Excludes sensitive fields
  - **Verification**: Integration tests pass

- [ ] 4.4 Add forgotPassword handler
  - `forgotPassword(req, res)`: calls `betterAuth.api.forgetPassword`
  - Always returns 200 (prevent enumeration)
  - Logs request (email hashed in logs)
  - **Verification**: Integration tests pass

- [ ] 4.5 Add resetPassword handler
  - `resetPassword(req, res)`: calls `betterAuth.api.resetPassword`
  - Validates token, updates password
  - Revokes all user sessions
  - Logs reset event
  - **Verification**: Integration tests pass

### 5. Auth Routes

- [ ] 5.1 Extend auth routes (`backend/routes/auth.js`)
  - `POST /login` → rateLimit(login) → bruteForce → validate(loginSchema) → controller.login
  - `POST /logout` → requireAuth → controller.logout
  - `GET /me` → requireAuth → controller.getMe
  - `POST /forgot-password` → rateLimit(reset) → validate(forgotPasswordSchema) → controller.forgotPassword
  - `POST /reset-password` → validate(resetPasswordSchema) → controller.resetPassword
  - **Verification**: All routes registered, middleware order correct

### 6. Better Auth Middleware Integration

- [ ] 6.1 Add Better Auth Express middleware to app (`backend/app.js`)
  - `auth.api.getSession` middleware to attach `req.user`, `req.session`
  - Mount before routes
  - **Verification**: `req.user` available in protected routes

### 7. Integration Tests

- [ ] 7.1 Extend test setup for auth (`backend/test/auth.setup.js`)
  - Helper: `createTestUser()` → registers user, returns credentials
  - Helper: `loginUser(email, password)` → returns cookies
  - Helper: `authenticatedRequest(cookies)` → request with cookies
  - **Verification**: Helpers work in test suite

- [ ] 7.2 Write login tests (`backend/app.test.js`)
  - Test: Valid login → 200, cookie set, user returned
  - Test: Wrong password → 401, INVALID_CREDENTIALS
  - Test: Unverified email (prod) → 403, EMAIL_NOT_VERIFIED
  - Test: RememberMe → cookie maxAge 30 days
  - Test: Rate limited → 429
  - Test: Brute force lock → 403 after 5 failures
  - **Verification**: All login tests pass

- [ ] 7.3 Write session tests
  - Test: GET /me with session → 200, user data
  - Test: GET /me without session → 401, UNAUTHENTICATED
  - Test: POST /logout → 200, cookie cleared
  - Test: POST /logout idempotent → 200
  - **Verification**: All session tests pass

- [ ] 7.4 Write password reset tests
  - Test: Forgot password (registered) → 200, email logged
  - Test: Forgot password (unregistered) → 200 (no enumeration)
  - Test: Reset password (valid token) → 200, password changed
  - Test: Reset password (invalid token) → 400, INVALID_RESET_TOKEN
  - Test: Reset password (expired token) → 400, RESET_TOKEN_EXPIRED
  - Test: Sessions revoked after reset → old cookie rejected
  - **Verification**: All reset tests pass

- [ ] 7.5 Write security tests
  - Test: Cookie has HttpOnly, Secure, SameSite=lax
  - Test: Password never in response body
  - Test: Password never in logs
  - Test: Reset token not in logs
  - **Verification**: Security assertions pass

### 8. Documentation

- [ ] 8.1 Update API documentation (if using OpenAPI/Swagger)
  - Document all auth endpoints
  - **Verification**: Docs generate without error

- [ ] 8.2 Update AGENTS.md if architectural decisions changed
  - **Verification**: AGENTS.md reflects implementation

## Progress Tracking

| Task Group | Status | Completed | Total |
|------------|--------|-----------|-------|
| Better Auth Config | Pending | 0 | 2 |
| Validation Schemas | Pending | 0 | 1 |
| Security Middleware | Pending | 0 | 3 |
| Auth Controller | Pending | 0 | 5 |
| Auth Routes | Pending | 0 | 1 |
| Better Auth Middleware | Pending | 0 | 1 |
| Integration Tests | Pending | 0 | 5 |
| Documentation | Pending | 0 | 2 |
| **Total** | | **0** | **20** |

## Notes

- Dependency: 001-registration must be complete (Better Auth instance, user model)
- Rate limiting and brute force can be developed in parallel
- Password reset requires email provider (mock in development)
- Session revocation on password reset is critical security feature
- All tests should use unique test users to avoid interference