# Constitution - Product Catalog Service

## Core Principles

### 1. Spec-Driven Development (SDD)
- **No implementation without specification**: Every feature must have an approved `spec.md` before any code is written
- **Single source of truth**: The `spec/` folder is the authoritative reference for what the system does
- **Traceability**: Each task in `tasks.md` maps to a requirement in `spec.md`

### 2. Test-First Development
- **Red-Green-Refactor**: Write failing tests first, make them pass, then refactor
- **Native Node Testing**: Use `node:test` and `node:assert` only - no external test frameworks
- **Coverage Target**: Minimum 80% branch coverage for critical paths

### 3. Architecture Principles
- **Layered Architecture**: Routes → Controllers → Services → Models (Repository Pattern)
- **Dependency Inversion**: Controllers depend on service interfaces, not implementations
- **Single Responsibility**: Each module has one reason to change
- **Database Agnostic**: Repository pattern abstracts JSON (MVP) and PostgreSQL (Prisma) behind same interface

### 4. Validation & Type Safety
- **Zod First**: All external inputs (params, query, body) validated with Zod schemas
- **TypeScript Strict**: `strict: true`, no `any` types, explicit return types
- **Schema-Driven**: Zod schemas are the source of truth for types (infer types from schemas)

### 5. Observability & Logging
- **Structured Logging**: All logs in Elastic Common Schema (ECS) format
- **Correlation IDs**: Every request carries `trace.id` and `span.id` through the system
- **Log Levels**: `debug`, `info`, `warn`, `error`, `fatal` - used appropriately
- **Centralized**: All logs shipped to ELK Stack via Logstash

### 6. API Design Standards
- **RESTful**: Resource-based URLs, HTTP verbs, proper status codes
- **Versioning**: `/api/v1/` prefix, backward compatible changes only
- **Pagination**: Cursor-based for lists, `page`/`limit` for simple cases
- **Error Format**: Consistent `{ error: { code, message, details } }` structure
- **Validation Errors**: 422 with Zod error details

### 7. Containerization & Deployment
- **Docker First**: Every service runs in Docker from development
- **Multi-stage Builds**: Separate build, test, and runtime stages
- **Health Checks**: `/health` endpoint for liveness/readiness probes
- **Environment Parity**: Same image runs in dev, staging, prod

### 8. Security
- **Input Validation**: Never trust client input - validate at boundaries
- **Secrets Management**: No secrets in code, use Docker secrets / env files
- **Rate Limiting**: Applied at API gateway level
- **CORS**: Configured per environment

### 9. Data Integrity
- **Optimistic Locking**: Version fields on entities for concurrent updates
- **Soft Deletes**: `deletedAt` timestamp, never hard delete
- **Audit Trail**: Created/updated by, timestamps on all entities
- **Transactions**: Prisma transactions for multi-model operations

### 10. Performance
- **Connection Pooling**: Prisma connection pool configured
- **Caching Strategy**: Redis for frequently accessed catalog data
- **Database Indexes**: Defined in Prisma schema for query patterns
- **Lazy Loading**: Avoid N+1 with explicit `include`/`select`

## Governance

### Amendment Process
1. Propose change via `spec/changes/NNN-name/`
2. Review by team (async or sync)
3. Approve → merge to main
4. Update affected specs and tasks

### Compliance
- CI/CD enforces: tests pass, lint clean, typecheck clean, Docker builds
- Pre-commit hooks: format, lint, typecheck
- Spec compliance checked in PR reviews

## Technology Decisions (Frozen)

| Category | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Node 22 LTS | Long-term support, modern features |
| Framework | Express 5 | Mature, middleware ecosystem |
| ORM | Prisma | Type-safe, migration system, DX |
| Validation | Zod | Schema-first, TypeScript inference |
| Testing | node:test | Zero dependencies, fast, built-in |
| Logging | Winston + ECS | Structured, ELK compatible |
| Container | Docker Compose | Local dev/prod parity |
| Database | PostgreSQL | Relational, ACID, JSON support |

## Non-Negotiables
- ❌ No `console.log` in production code
- ❌ No direct database access in controllers
- ❌ No business logic in routes
- ❌ No `any` type in TypeScript
- ❌ No skipping tests for "simple" changes
- ❌ No hardcoded configuration
- ❌ No committing directly to main branch