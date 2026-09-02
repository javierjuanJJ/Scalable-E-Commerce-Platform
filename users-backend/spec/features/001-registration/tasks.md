# Tasks: User Registration

## Overview

**Feature**: 001-registration  
**Tracking**: This file tracks implementation progress per OpenSpec workflow

## Task Breakdown

### 1. Project Setup & Configuration

- [ ] 1.1 Initialize Node.js project with TypeScript
  - `npm init -y`
  - `npm install typescript @types/node --save-dev`
  - `npx tsc --init` with strict mode
  - **Verification**: `npx tsc --noEmit` passes

- [ ] 1.2 Install core dependencies
  - `npm install express@5 zod pino pino-elasticsearch better-auth`
  - `npm install @prisma/client @prisma/adapter-pg dotenv`
  - `npm install --save-dev @types/express`
  - **Verification**: `package.json` has all deps, `npm ls` clean

- [ ] 1.3 Configure ESLint + Prettier + Husky
  - `npm install --save-dev eslint prettier husky lint-staged`
  - Add pre-commit hook for format/lint
  - **Verification**: `npm run lint` and `npm run format` work

### 2. Better Auth Configuration

- [ ] 2.1 Create Better Auth instance (`backend/lib/auth.js`)
  - Configure emailAndPassword plugin
  - Set up JSON adapter for MVP
  - Configure email verification callback
  - **Verification**: `auth` exports valid Better Auth instance

- [ ] 2.2 Create JSON storage adapter (`backend/adapters/json-adapter.js`)
  - Implement `createUser()`, `getUserByEmail()`, `getUserById()`
  - Atomic file writes with temp file + rename
  - In-memory cache with write-through
  - **Verification**: Unit tests pass for CRUD operations

- [ ] 2.3 Define Prisma schema (`prisma/schema.prisma`)
  - User, Session, Account models
  - PostgreSQL datasource
  - Prisma Client generator
  - **Verification**: `npx prisma validate` passes

### 3. Validation Schemas (Zod)

- [ ] 3.1 Create auth schemas (`backend/schemas/auth.js`)
  - `registerSchema`: email (email), password (min 8, max 128), name (optional, max 100)
  - `loginSchema`: email (email), password (string), rememberMe (boolean optional)
  - Export typed schemas with inference
  - **Verification**: TypeScript compiles, Zod validation works

- [ ] 3.2 Create common schemas (`backend/schemas/common.js`)
  - `paginationSchema`: page, limit
  - `errorResponseSchema`: code, message, details
  - **Verification**: Reused across features

### 4. Validation Middleware

- [ ] 4.1 Create validation middleware (`backend/middlewares/validate.js`)
  - Accepts Zod schema, validates req.body
  - Returns 400 with formatted Zod errors on failure
  - Attaches validated data to `req.validated`
  - **Verification**: Integration test with invalid input returns 400

### 5. User Model (JSON MVP)

- [ ] 5.1 Implement user model (`backend/models/user.js`)
  - `create(userData)`: writes to `data/users.json`
  - `findByEmail(email)`: reads and filters
  - `findById(id)`: reads and filters
  - `update(id, data)`: partial update
  - `delete(id)`: soft delete or remove
  - **Verification**: Unit tests for all methods

- [ ] 5.2 Create data directory and initial file
  - `mkdir -p backend/data`
  - `echo '[]' > backend/data/users.json`
  - **Verification**: File exists, valid JSON array

### 6. Auth Controller

- [ ] 6.1 Create auth controller (`backend/controllers/auth.js`)
  - `register(req, res)`: calls Better Auth `signUpEmail`
  - Handles Better Auth errors, maps to HTTP responses
  - Logs registration events with Pino
  - Returns user without passwordHash
  - **Verification**: Integration tests pass

- [ ] 6.2 Create auth routes (`backend/routes/auth.js`)
  - `POST /api/v1/auth/register` → validate(registerSchema) → controller.register
  - `POST /api/v1/auth/login` → validate(loginSchema) → controller.login (for feature 002)
  - Export router
  - **Verification**: Routes registered in app.js

### 7. Express App Setup

- [ ] 7.1 Create Express app (`backend/app.js`)
  - CORS middleware (configured for frontend origin)
  - JSON body parser
  - Request logging middleware (Pino)
  - Mount auth routes at `/api/v1/auth`
  - Error handling middleware
  - Health check endpoint `GET /health`
  - **Verification**: `node backend/app.js` starts server

- [ ] 7.2 Create CORS middleware (`backend/middlewares/cors.js`)
  - Allow configured origin
  - Credentials: true for cookies
  - **Verification**: CORS headers present in responses

### 8. Structured Logging

- [ ] 8.1 Configure Pino logger (`backend/lib/logger.js`)
  - Pretty print in development
  - JSON in production
  - Child loggers with service name
  - **Verification**: Logs appear in console with correct structure

- [ ] 8.2 Add Elasticsearch transport (prep for feature 004)
  - Conditional transport based on `ELASTICSEARCH_NODE` env
  - Batch configuration: flushBytes=1000, flushInterval=30000
  - **Verification**: Logs sent to Elasticsearch when configured

### 9. Integration Tests

- [ ] 9.1 Create test setup (`backend/test/setup.js`)
  - Start Express server on random port
  - Cleanup: close server, clear test data
  - Export `fetch` helper using `supertest` or native `fetch`
  - **Verification**: Test server starts/stops cleanly

- [ ] 9.2 Write registration tests (`backend/app.test.js`)
  - Test: Valid registration → 201, user returned
  - Test: Duplicate email → 409, EMAIL_ALREADY_EXISTS
  - Test: Invalid email → 400, Zod errors
  - Test: Weak password → 400, Zod errors
  - Test: Missing fields → 400, Zod errors
  - Test: PasswordHash not in response
  - Test: Structured log emitted
  - **Verification**: `npm test` passes all registration tests

### 10. Documentation & Scripts

- [ ] 10.1 Add npm scripts to `package.json`
  - `dev`: `tsx watch backend/app.js`
  - `build`: `tsc`
  - `start`: `node dist/backend/app.js`
  - `test`: `node --test backend/**/*.test.js`
  - `db:generate`: `prisma generate`
  - `db:push`: `prisma db push`
  - `db:studio`: `prisma studio`
  - **Verification**: All scripts run without error

- [ ] 10.2 Create `.env.example`
  - Document all required environment variables
  - **Verification**: Team can copy and run

- [ ] 10.3 Update AGENTS.md if needed
  - Reflect any architectural decisions made during implementation
  - **Verification**: AGENTS.md matches implementation

## Progress Tracking

| Task Group | Status | Completed | Total |
|------------|--------|-----------|-------|
| Project Setup | Pending | 0 | 3 |
| Better Auth Config | Pending | 0 | 3 |
| Validation Schemas | Pending | 0 | 2 |
| Validation Middleware | Pending | 0 | 1 |
| User Model (JSON) | Pending | 0 | 2 |
| Auth Controller | Pending | 0 | 2 |
| Express App | Pending | 0 | 2 |
| Structured Logging | Pending | 0 | 2 |
| Integration Tests | Pending | 0 | 2 |
| Documentation | Pending | 0 | 3 |
| **Total** | | **0** | **25** |

## Notes

- Tasks follow dependency order: setup → config → schemas → middleware → models → controllers → routes → app → tests
- Each task includes verification criteria for "definition of done"
- Parallelizable tasks marked (e.g., 3.1 and 3.2 can run in parallel)
- Blocker: Better Auth JSON adapter needs implementation before controller tests