# Tasks: Microservices MVP

## Overview

**Feature**: 006-microservices-mvp  
**Depends On**: 001-registration, 002-authentication, 003-profile-management, 004-centralized-logging, 005-docker-compose

This is the integration feature - all previous features must be complete.

## Task Breakdown

### 1. Storage Abstraction Layer

- [ ] 1.1 Create storage factory (`backend/lib/storage.js`)
  - Exports `getAdapter()` returning json or prisma adapter based on `STORAGE` env
  - **Verification**: Factory returns correct adapter

- [ ] 1.2 Create JSON adapter (`backend/adapters/json-adapter.js`)
  - Implements all Better Auth required methods
  - Uses `models/user.js` and session storage
  - **Verification**: Better Auth works with JSON adapter

- [ ] 1.3 Create Prisma adapter (`backend/adapters/prisma-adapter.js`)
  - Implements all Better Auth required methods using Prisma Client
  - Uses `@prisma/adapter-pg` for connection pooling
  - **Verification**: Better Auth works with Prisma adapter

- [ ] 1.4 Update Better Auth config to use storage factory (`backend/lib/auth.js`)
  - Import `getAdapter` from storage factory
  - Pass adapter to Better Auth `database` option
  - **Verification**: Auth works in both modes

### 2. Prisma Setup

- [ ] 2.1 Finalize Prisma schema (`prisma/schema.prisma`)
  - User, Session, Account models
  - PostgreSQL datasource
  - **Verification**: `npx prisma validate` passes

- [ ] 2.2 Generate Prisma Client
  - `npm run db:generate` (script: `prisma generate`)
  - **Verification**: Client generated in `node_modules/.prisma/client`

- [ ] 2.3 Create migration script (`scripts/migrate-json-to-prisma.js`)
  - Reads `data/users.json` and `data/sessions.json`
  - Upserts users via Prisma (by email)
  - Creates sessions via Prisma
  - Verifies counts match
  - Logs progress
  - **Verification**: Migration completes, data accessible via Prisma

### 3. Production Readiness

- [ ] 3.1 Implement graceful shutdown (`backend/app.js`)
  - SIGTERM/SIGINT handlers
  - Close HTTP server
  - Disconnect Prisma
  - Flush logger
  - 30s force exit timeout
  - **Verification**: `docker stop` exits cleanly in < 30s

- [ ] 3.2 Add configuration validation (`backend/lib/config.js`)
  - Validates required env vars on startup
  - Fails fast with clear messages
  - **Verification**: Missing env → clear error, exit 1

- [ ] 3.3 Implement global error handler (`backend/middlewares/error-handler.js`)
  - Catches all unhandled errors
  - Logs with traceId, stack
  - Returns 500 with generic message in production
  - Handles ZodError, Prisma errors
  - **Verification**: Thrown error → 500, logged

- [ ] 3.4 Verify rate limiting & brute force active
  - Login: 10/min/IP
  - Register: 5/min/IP
  - Brute force: 5 failures → 15 min lock
  - **Verification**: Integration tests pass

### 4. OpenAPI Documentation

- [ ] 4.1 Generate OpenAPI spec (`backend/lib/openapi.js`)
  - Use `zod-to-openapi` or manual spec
  - Documents all endpoints, schemas, errors
  - **Verification**: `GET /api/docs/openapi.json` returns valid OpenAPI 3.1

- [ ] 4.2 Serve Swagger UI
  - Mount at `/api/docs`
  - **Verification**: Browser shows Swagger UI with all endpoints

### 5. Integration Test Suite (Complete)

- [ ] 5.1 Run full test suite (`npm test`)
  - All tests from features 001-003 pass
  - Health endpoint tests pass
  - Security tests pass
  - **Verification**: 100% pass rate

- [ ] 5.2 Test both storage modes
  - `STORAGE=json npm test` → pass
  - `STORAGE=prisma DATABASE_URL=... npm test` → pass
  - **Verification**: Both modes tested

- [ ] 5.3 Test migration
  - Run migration script
  - Run tests in Prisma mode
  - Verify passwords work
  - **Verification**: Migration successful

### 6. Quality Gates

- [ ] 6.1 TypeScript strict check
  - `npm run typecheck` → `npx tsc --noEmit`
  - No errors, strict mode enabled
  - **Verification**: Exit code 0

- [ ] 6.2 Linting
  - `npm run lint` → ESLint + Prettier
  - No errors, formatting correct
  - **Verification**: Exit code 0

- [ ] 6.3 Security audit
  - `npm audit` → no critical/high
  - `docker scout cves user-service` or `trivy image user-service`
  - **Verification**: Clean audit

- [ ] 6.4 Docker build & run
  - `docker build -t user-service .` → success
  - `docker compose -f compose.yaml -f compose.dev.yaml up` → all healthy
  - App responds to requests
  - **Verification**: Full stack operational

### 7. Documentation & Finalization

- [ ] 7.1 Update AGENTS.md with final architecture
  - Reflects all implemented decisions
  - **Verification**: AGENTS.md accurate

- [ ] 7.2 Create .env.example with all variables
  - Documented with descriptions
  - **Verification**: New developer can copy and run

- [ ] 7.3 Create README.md for users-backend
  - Quick start, architecture, scripts, testing
  - **Verification**: README complete

- [ ] 7.4 Verify all acceptance criteria met
  - Check against AC table in spec.md
  - **Verification**: All ACs satisfied

## Progress Tracking

| Task Group | Status | Completed | Total |
|------------|--------|-----------|-------|
| Storage Abstraction | Pending | 0 | 4 |
| Prisma Setup | Pending | 0 | 3 |
| Production Readiness | Pending | 0 | 4 |
| OpenAPI Documentation | Pending | 0 | 2 |
| Integration Tests | Pending | 0 | 3 |
| Quality Gates | Pending | 0 | 4 |
| Documentation | Pending | 0 | 4 |
| **Total** | | **0** | **24** |

## Notes

- This feature is the integration point - all previous features must work together
- Run tests in both JSON and Prisma modes to ensure compatibility
- Migration script should be idempotent and well-tested
- Quality gates must pass before considering MVP complete
- Docker Compose is the primary way to run the full stack
- Keep AGENTS.md updated as single source of truth for architecture