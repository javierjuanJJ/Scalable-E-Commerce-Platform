# Implementation Plan: User Registration

## Overview

**Feature**: 001-registration  
**Approach**: Better Auth integration with Express 5, Zod validation, JSON MVP storage

## Architecture Decisions

### 1. Better Auth as Auth Core
- Use Better Auth's `emailAndPassword` plugin for registration logic
- Better Auth handles: password hashing (Argon2id), email verification, session creation
- Custom adapter for JSON storage (MVP) → Prisma adapter (production)

### 2. Express Route Structure
```
POST /api/v1/auth/register
  → middleware/validate(schemas.auth.register)
  → controllers/auth.register
  → betterAuth.api.signUpEmail()
  → response with user (no passwordHash)
```

### 3. Validation Layer (Zod)
- `schemas/auth.js` exports `registerSchema`, `loginSchema`
- Middleware validates request body before controller
- Returns 400 with detailed Zod errors on failure

### 4. JSON Storage Adapter (MVP)
- `models/user.js` implements: `create()`, `findByEmail()`, `findById()`
- Atomic file writes using `fs.promises.writeFile` with temp file + rename
- In-memory cache with periodic persistence (or write-through)

### 5. Logging Integration
- Pino logger injected into controllers
- Structured logs: `{ level, time, service, traceId, msg, userId, email }`
- Registration events: `user.registered`, `user.registration_failed`

## Data Flow

```
Client Request
    ↓
Express Router (routes/auth.js)
    ↓
Validation Middleware (Zod)
    ↓
Controller (controllers/auth.js)
    ↓
Better Auth API (signUpEmail)
    ↓
JSON Model / Prisma Adapter
    ↓
Response + Logging
```

## Better Auth Configuration

```typescript
// lib/auth.js
import { betterAuth } from 'better-auth';
import { jsonAdapter } from './adapters/json-adapter'; // MVP
// import { prismaAdapter } from './adapters/prisma-adapter'; // Production

export const auth = betterAuth({
  database: process.env.NODE_ENV === 'production' 
    ? prismaAdapter 
    : jsonAdapter,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === 'production',
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false, // Return user, let client call login
  },
  // Email verification callback
  sendVerificationEmail: async ({ user, url, token }) => {
    // Integrate with email provider (nodemailer, sendgrid, etc.)
    logger.info({ userId: user.id, email: user.email }, 'Verification email queued');
  },
});
```

## Error Handling Strategy

| Error Type | HTTP Status | Response Format |
|------------|-------------|-----------------|
| Validation Error | 400 | `{ errors: [{ field, message }] }` |
| Duplicate Email | 409 | `{ code: 'EMAIL_ALREADY_EXISTS', message }` |
| Better Auth Error | 400/500 | `{ code, message }` |
| Internal Error | 500 | `{ code: 'INTERNAL_ERROR', message }` |

## Testing Strategy

### Integration Tests (app.test.js)
1. **Happy Path**: Valid registration → 201, user returned, logged
2. **Duplicate Email**: Second registration → 409, error code
3. **Invalid Email**: Malformed email → 400, Zod errors
4. **Weak Password**: Short password → 400, Zod errors
5. **Missing Fields**: No email/password → 400, Zod errors
6. **Password Not in Response**: Verify passwordHash absent
7. **Log Emission**: Verify structured log output

### Unit Tests (if needed)
- Zod schema validation logic
- JSON adapter create/find methods
- Better Auth configuration validation

## Migration Path to PostgreSQL

1. **Phase 1 (MVP)**: JSON adapter implements `create()`, `findByEmail()`, `findById()`
2. **Phase 2**: Prisma schema defined in `prisma/schema.prisma`
3. **Phase 3**: Prisma adapter implemented using `@prisma/adapter-pg`
4. **Phase 4**: Migration script reads JSON, writes to PostgreSQL via Prisma
5. **Phase 5**: Switch adapter via environment variable

## File Structure Impact

```
backend/
├── schemas/
│   └── auth.js              # Zod schemas for register/login
├── models/
│   └── user.js              # JSON MVP implementation
├── routes/
│   └── auth.js              # POST /register, /login
├── controllers/
│   └── auth.js              # Orchestration logic
├── lib/
│   └── auth.js              # Better Auth configuration
├── adapters/
│   ├── json-adapter.js      # MVP storage
│   └── prisma-adapter.js    # Production (future)
└── middlewares/
    └── validate.js          # Zod validation middleware
```

## Configuration

### Environment Variables
```env
NODE_ENV=development
BETTER_AUTH_SECRET=<32-char-random>
BETTER_AUTH_URL=http://localhost:3000
EMAIL_VERIFICATION_CALLBACK_URL=http://localhost:3000/verify
```

## Rollback Plan

If Better Auth integration fails:
1. Fallback to custom JWT implementation (bcrypt + jsonwebtoken)
2. Keep Zod validation and Express structure
3. Estimated effort: 1 day

## Performance Considerations

- JSON file locking for concurrent writes (use `proper-lockfile` or similar)
- Connection pooling not needed for JSON MVP
- Prisma connection pool: `pool_size=10` for production
- Rate limiting via `express-rate-limit` middleware