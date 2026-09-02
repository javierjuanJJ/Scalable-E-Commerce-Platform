# Implementation Plan: Microservices MVP

## Overview

**Feature**: 006-microservices-mvp  
**Depends On**: 001-registration, 002-authentication, 003-profile-management, 004-centralized-logging, 005-docker-compose

This feature integrates all previous features into a production-ready MVP microservice.

## Architecture Decisions

### 1. Storage Abstraction Layer

```
backend/
├── models/
│   ├── user.js              # Interface: create, findByEmail, findById, update, delete, findAll, count
│   ├── session.js           # Interface: create, find, delete, deleteUserSessions
│   ├── json-adapter.js      # JSON file implementation
│   └── prisma-adapter.js    # Prisma implementation
├── lib/
│   └── storage.js           # Factory: returns correct adapter based on env
```

**Factory Pattern** (`lib/storage.js`):
```javascript
const { jsonAdapter } = require('./adapters/json-adapter');
const { prismaAdapter } = require('./adapters/prisma-adapter');

function getAdapter() {
  const storage = process.env.STORAGE || 'json';
  switch (storage) {
    case 'prisma':
      return prismaAdapter;
    case 'json':
    default:
      return jsonAdapter;
  }
}

module.exports = { getAdapter };
```

### 2. Better Auth Adapter Interface

Better Auth requires specific adapter methods. Implement both JSON and Prisma versions:

```javascript
// Required by Better Auth:
{
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  deleteUser,
  createSession,
  getSession,
  deleteSession,
  deleteUserSessions,
  // ... account linking methods
}
```

### 3. Prisma Schema & Migrations

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  name          String?
  avatarUrl     String?
  emailVerified Boolean   @default(false)
  role          Role      @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  providerId        String
  providerAccountId String
  @@unique([providerId, providerAccountId])
}

enum Role {
  USER
  ADMIN
}
```

### 4. Graceful Shutdown

```javascript
// backend/app.js
let server;

function gracefulShutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received');
  
  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Close database connections
    if (prisma) {
      await prisma.$disconnect();
      logger.info('Database connections closed');
    }
    
    // Flush logs
    await logger.flush();
    logger.info('Logs flushed');
    
    process.exit(0);
  });
  
  // Force exit after 30s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### 5. Configuration Validation

```javascript
// backend/lib/config.js
const requiredEnv = [
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  // STORAGE=prisma requires:
  // 'DATABASE_URL',
];

function validateConfig() {
  const missing = requiredEnv.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (process.env.STORAGE === 'prisma' && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL required when STORAGE=prisma');
  }
}

module.exports = { validateConfig };
```

### 6. Global Error Handler

```javascript
// backend/middlewares/error-handler.js
function errorHandler(err, req, res, next) {
  const traceId = req.traceId || 'unknown';
  
  logger.error({ 
    err: { message: err.message, stack: err.stack },
    traceId,
    path: req.path,
    method: req.method 
  }, 'Unhandled error');
  
  if (err.name === 'ZodError') {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: err.errors
    });
  }
  
  if (err.code === 'P2002') { // Prisma unique constraint
    return res.status(409).json({
      code: 'DUPLICATE_ENTRY',
      message: 'Resource already exists'
    });
  }
  
  const status = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal server error'
    : err.message;
  
  res.status(status).json({ code, message });
}

module.exports = { errorHandler };
```

### 7. OpenAPI Documentation

Use `zod-to-openapi` or manual spec generation:

```javascript
// backend/lib/openapi.js
// Generate OpenAPI 3.1 spec from Zod schemas
// Serve at /api/docs/openapi.json
// Swagger UI at /api/docs
```

### 8. Migration Script

```javascript
// scripts/migrate-json-to-prisma.js
// Reads data/users.json, data/sessions.json
// Writes via Prisma Client
// Idempotent: upserts by email/id
// Logs progress
```

## Data Flow

### Request Flow (Production)
```
HTTP Request
  → Docker/Load Balancer
  → Express (app.js)
  → CORS, Body Parser
  → TraceId Middleware
  → Request Logger
  → Better Auth Session Middleware
  → Rate Limit / Brute Force
  → Route Handler
  → Validation Middleware (Zod)
  → Controller
  → Storage Adapter (Prisma)
  → Response
  → Request Logger (response)
  → Pino → Elasticsearch
```

### Migration Flow
```
npm run migrate
  → Validate env (DATABASE_URL)
  → Initialize Prisma Client
  → Read JSON files
  → For each user: upsert via Prisma
  → For each session: create via Prisma
  → Verify counts match
  → Log completion
```

## Testing Strategy

### Integration Tests (Complete Suite)
1. **Registration**: Valid, duplicate, invalid email, weak password, missing fields
2. **Login**: Valid, invalid credentials, unverified email, remember me
3. **Session**: Get me, logout, logout idempotent
4. **Password Reset**: Forgot, reset valid, reset invalid, reset expired
5. **Profile Self**: Get, update valid, update partial, reject disallowed fields
6. **Profile Delete**: Valid password, wrong password, missing password
7. **Admin**: List (pagination, search, filter, sort), get, update, delete
8. **Admin Auth**: Non-admin denied
9. **Health**: Live, ready (healthy), ready (degraded)
10. **Security**: Rate limit, brute force, cookie attributes, no sensitive data in logs
11. **Storage**: JSON mode works, Prisma mode works

### Migration Tests
1. **Migration Script**: Transfers all users, sessions
2. **Idempotency**: Re-run doesn't duplicate
3. **Data Integrity**: Passwords work after migration
4. **Rollback**: JSON files unchanged

### Quality Gates
1. **TypeScript**: `npx tsc --noEmit` - strict mode, no errors
2. **Lint**: `npm run lint` - ESLint + Prettier
3. **Test**: `npm test` - all integration tests pass
4. **Audit**: `npm audit` - no critical/high
5. **Docker**: `docker build` + `docker compose up` - healthy

## File Structure (Final)

```
users-backend/
├── AGENTS.md
├── package.json
├── tsconfig.json
├── .env.example
├── .dockerignore
├── Dockerfile
├── compose.yaml
├── compose.dev.yaml
├── compose.prod.yaml
├── compose.logging.yaml
├── prisma/
│   └── schema.prisma
├── backend/
│   ├── app.js
│   ├── app.test.js
│   ├── lib/
│   │   ├── auth.js
│   │   ├── logger.js
│   │   ├── security-logger.js
│   │   ├── config.js
│   │   ├── storage.js
│   │   └── openapi.js
│   ├── adapters/
│   │   ├── json-adapter.js
│   │   └── prisma-adapter.js
│   ├── middlewares/
│   │   ├── cors.js
│   │   ├── validate.js
│   │   ├── requireAuth.js
│   │   ├── requireAdmin.js
│   │   ├── rateLimit.js
│   │   ├── bruteForce.js
│   │   ├── trace-id.js
│   │   ├── request-logger.js
│   │   └── error-handler.js
│   ├── schemas/
│   │   ├── auth.js
│   │   ├── user.js
│   │   └── common.js
│   ├── models/
│   │   └── user.js
│   ├── controllers/
│   │   ├── auth.js
│   │   ├── user.js
│   │   └── health.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── user.js
│   │   └── health.js
│   └── test/
│       ├── setup.js
│       ├── auth.test.js
│       ├── user.test.js
│       └── logging.test.js
├── logstash/
│   └── pipeline/
│       └── logstash.conf
├── kibana/
│   └── dashboards/
├── scripts/
│   ├── migrate-json-to-prisma.js
│   └── es-index-template.js
└── spec/
    ├── constitution/
    │   ├── mission.md
    │   ├── tech-stack.md
    │   └── roadmap.md
    └── features/
        ├── 001-registration/
        ├── 002-authentication/
        ├── 003-profile-management/
        ├── 004-centralized-logging/
        ├── 005-docker-compose/
        └── 006-microservices-mvp/
```

## Configuration (Final .env.example)

```env
# Application
NODE_ENV=development
PORT=3000
STORAGE=json                    # json | prisma

# Better Auth
BETTER_AUTH_SECRET=generate-32-char-random-string
BETTER_AUTH_URL=http://localhost:3000
EMAIL_VERIFICATION_CALLBACK_URL=http://localhost:3000/verify

# Database (required for STORAGE=prisma)
DATABASE_URL=postgresql://user:pass@localhost:5432/users

# Logging
LOG_LEVEL=info
LOG_PRETTY=true
ELASTICSEARCH_NODE=http://localhost:9200

# Rate Limiting
RATE_LIMIT_LOGIN_MAX=10
RATE_LIMIT_LOGIN_WINDOW_MS=60000
RATE_LIMIT_REGISTER_MAX=5
RATE_LIMIT_REGISTER_WINDOW_MS=60000

# Brute Force
BRUTE_FORCE_MAX_ATTEMPTS=5
BRUTE_FORCE_LOCKOUT_MS=900000
```

## Rollback Plan

If MVP issues:
1. **JSON Mode**: Set `STORAGE=json`, remove `DATABASE_URL` - works without PostgreSQL
2. **Disable ELK**: Remove `ELASTICSEARCH_NODE` - logs to stdout only
3. **Disable Rate Limit**: Set limits very high
4. **Revert Commits**: Each feature in separate commits for granular rollback