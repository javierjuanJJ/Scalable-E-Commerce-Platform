# Tasks: Develop Microservices (MVP)

## Phase 1: Project Initialization

- [ ] **T001** Create package.json (`backend/package.json`)
  - Dependencies: express@5, zod, winston, @prisma/client, pino-pretty, prom-client, @opentelemetry/api, @opentelemetry/sdk-node, @opentelemetry/auto-instrumentations-node, @opentelemetry/exporter-prometheus, helmet, cors, express-rate-limit, jsonwebtoken, jwks-rsa, uuid, pino
  - DevDependencies: typescript, @types/node, @types/express, @types/cors, @types/jsonwebtoken, @types/uuid, prisma, tsx, supertest, @types/supertest
  - Scripts: dev, build, start, test, test:integration, test:coverage, lint, typecheck, prisma:generate, prisma:migrate, prisma:studio

- [ ] **T002** Create tsconfig.json (`backend/tsconfig.json`)
  - Target: ES2022, Module: NodeNext, ModuleResolution: NodeNext
  - Strict: true, noUncheckedIndexedAccess, exactOptionalPropertyTypes
  - Paths: @/* → src/*
  - Include: src/**, tests/**

- [ ] **T003** Create .env.example (`backend/.env.example`)
  - All variables from plan with descriptions
  - Development defaults
  - Production required fields marked

- [ ] **T004** Create directory structure
  - src/{config,middleware,routes,controllers,services,models,schemas,utils,types}
  - models/interfaces, models/repositories
  - tests/{unit,integration,fixtures,utils}
  - prisma/

## Phase 2: Configuration & Core

- [ ] **T005** Create Zod env schema (`backend/src/config/env.schema.ts`)
  - All variables with validation
  - Export Env type

- [ ] **T006** Create config loader (`backend/src/config/index.ts`)
  - Parse process.env with schema
  - Throw on validation error
  - Export validated config object

- [ ] **T007** Create Express types extension (`backend/src/types/express.d.ts`)
  - Request: user, requestId, log, traceId
  - Response: locals

- [ ] **T008** Create event types (`backend/src/types/events.ts`)
  - DomainEvent interface
  - ProductEvents, CategoryEvents, InventoryEvents types
  - EventHandler type

## Phase 3: Middleware Suite

- [ ] **T009** Create requestId middleware (`backend/src/middleware/requestId.ts`)
  - Extract traceparent or generate UUID v4
  - Set req.requestId, res.setHeader('X-Request-Id')
  - Add to logger context

- [ ] **T010** Create CORS middleware (`backend/src/middleware/cors.ts`)
  - Configurable origins (env: CORS_ORIGINS)
  - Credentials: true
  - Methods: GET, POST, PATCH, DELETE, OPTIONS

- [ ] **T011** Create Helmet middleware (`backend/src/middleware/helmet.ts`)
  - Content Security Policy (restrictive)
  - HSTS, X-Frame-Options, X-Content-Type-Options
  - Referrer-Policy, Permissions-Policy

- [ ] **T012** Create rateLimit middleware (`backend/src/middleware/rateLimit.ts`)
  - express-rate-limit with Redis store
  - Window: 15 min, Max: 100 requests (configurable)
  - Skip health endpoints
  - Headers: X-RateLimit-Limit, Remaining, Reset

- [ ] **T013** Create auth middleware (`backend/src/middleware/auth.ts`)
  - Verify JWT with jwks-rsa (RS256)
  - Validate iss, aud, exp, nbf
  - Attach user to req.user
  - Optional: allow anonymous for public routes

- [ ] **T014** Create RBAC middleware (`backend/src/middleware/rbac.ts`)
  - Roles: admin, user, service
  - Permissions: resource:action
  - Middleware factory: requireRole(), requirePermission()

- [ ] **T015** Create validation middleware (`backend/src/middleware/validation.ts`)
  - Factory: validate(schema, source: 'body'|'query'|'params')
  - Zod error formatting → 422 response
  - Attach validated data to req.validated

- [ ] **T016** Create error handler (`backend/src/middleware/errorHandler.ts`)
  - Catch all errors
  - Map: ZodError→422, NotFound→404, VersionConflict→409, Unauthorized→401, Forbidden→403
  - Log with ECS format (feature 004)
  - Structured error response

- [ ] **T017** Create metrics middleware (`backend/src/middleware/metrics.ts`)
  - prom-client: http_requests_total, http_request_duration_seconds
  - Labels: method, route, status_code
  - Default metrics: Node.js, GC, EventLoop

## Phase 4: Health & App Factory

- [ ] **T018** Create health routes (`backend/src/routes/health.ts`)
  - GET /health → { status: 'ok', version, uptime }
  - GET /ready → { status, checks: { database, redis, logstash } }
  - Dependency checks with timeout

- [ ] **T019** Create app factory (`backend/src/app.ts`)
  - Create Express app
  - Apply middleware in correct order
  - Register routes
  - Return app instance

- [ ] **T020** Create server entry (`backend/src/server.ts`)
  - Load config
  - Initialize logger, tracing, metrics
  - Create app, listen on port
  - Graceful shutdown: SIGTERM/SIGINT → stop accepting → close connections → exit
  - Handle uncaught exceptions

## Phase 5: Domain Layer (Shared with Features 001-003)

- [ ] **T021** Create domain types (`backend/src/models/index.ts`)
  - Re-export from features 001-003
  - Base interfaces: Entity, SoftDeletable, Timestamped

- [ ] **T022** Create repository interfaces (`backend/src/models/interfaces/`)
  - IProductRepository (from 001)
  - ICategoryRepository (from 002)
  - IInventoryRepository (from 003)

- [ ] **T023** Create Zod schemas (`backend/src/schemas/`)
  - product.ts (from 001)
  - category.ts (from 002)
  - inventory.ts (from 003)

## Phase 6: JSON Repositories (MVP)

- [ ] **T024** Create JSON repositories (`backend/src/models/repositories/`)
  - ProductRepositoryJson.ts (from 001)
  - CategoryRepositoryJson.ts (from 002)
  - InventoryRepositoryJson.ts (from 003)
  - Shared: file locking, indexes, transactions

- [ ] **T025** Create repository factory (`backend/src/models/repositories/factory.ts`)
  - getProductRepository(), getCategoryRepository(), getInventoryRepository()
  - Switch on config.DATABASE_PROVIDER

## Phase 7: Services & Event Bus

- [ ] **T026** Create EventBus (`backend/src/services/EventBus.ts`)
  - In-memory EventEmitter
  - Persist events to JSON file (audit)
  - subscribe/publish with type safety
  - Idempotency via eventId tracking
  - Dead letter queue for failed handlers

- [ ] **T027** Create ProductService (`backend/src/services/ProductService.ts`)
  - Business logic from 001
  - Event publishing
  - Cache integration

- [ ] **T028** Create CategoryService (`backend/src/services/CategoryService.ts`)
  - Business logic from 002
  - Event publishing
  - Product count sync via event handlers

- [ ] **T029** Create InventoryService (`backend/src/services/InventoryService.ts`)
  - Business logic from 003
  - Event publishing
  - Background jobs (expiration, low stock)

## Phase 8: Controllers & Routes

- [ ] **T030** Create BaseController (`backend/src/controllers/BaseController.ts`)
  - Common: ok, created, notFound, badRequest, conflict
  - Pagination helper

- [ ] **T031** Create controllers (`backend/src/controllers/`)
  - ProductController.ts (from 001)
  - CategoryController.ts (from 002)
  - InventoryController.ts (from 003)

- [ ] **T032** Create routes (`backend/src/routes/`)
  - products.ts (from 001)
  - categories.ts (from 002)
  - inventory.ts (from 003)
  - index.ts - register all with prefixes

## Phase 9: Utilities & Observability

- [ ] **T033** Create logger (`backend/src/utils/logger.ts`)
  - Integrate feature 004 logger
  - Service-specific defaults

- [ ] **T034** Create HTTP client (`backend/src/utils/httpClient.ts`)
  - Fetch wrapper with retry, timeout, circuit breaker
  - Correlation header propagation
  - Error mapping

- [ ] **T035** Create tracing (`backend/src/utils/tracing.ts`)
  - OpenTelemetry SDK init
  - Resource: service.name, version
  - Exporters: Prometheus, Console (dev)
  - Auto-instrumentations: HTTP, Express, Prisma, Redis

- [ ] **T036** Create crypto utils (`backend/src/utils/crypto.ts`)
  - UUID v4/v7
  - Hash (bcrypt for passwords if needed)
  - Random string generation

## Phase 10: Prisma Integration

- [ ] **T037** Create Prisma schema (`backend/prisma/schema.prisma`)
  - Product, Category, Inventory, Location, Reservation, StockAdjustment, StockTransfer
  - Relations, indexes, enums
  - Generator: prisma-client-js

- [ ] **T038** Create Prisma repositories (`backend/src/models/repositories/`)
  - ProductRepositoryPrisma.ts
  - CategoryRepositoryPrisma.ts
  - InventoryRepositoryPrisma.ts
  - Transactions, optimistic locking

- [ ] **T039** Create migration scripts
  - JSON → Prisma for all domains
  - Verification scripts

## Phase 11: Testing Infrastructure

- [ ] **T040** Create test config (`backend/tests/setup.ts`)
  - Global setup/teardown
  - Test database container
  - Logger silence in tests

- [ ] **T041** Create factories (`backend/tests/utils/factories.ts`)
  - createProduct(overrides?)
  - createCategory(overrides?)
  - createInventory(overrides?)
  - createReservation(overrides?)

- [ ] **T042** Create fixtures (`backend/tests/fixtures/`)
  - products.json, categories.json, inventory.json, locations.json
  - Load/cleanup utilities

- [ ] **T043** Create test HTTP client (`backend/tests/utils/httpClient.ts`)
  - Supertest wrapper
  - Auth helpers (admin token, user token)
  - Request/response logging

- [ ] **T044** Write unit tests (`backend/tests/unit/`)
  - Config validation
  - Middleware (each)
  - Services (each)
  - Repositories (JSON + Prisma)
  - EventBus
  - HTTP Client

- [ ] **T045** Write integration tests (`backend/tests/integration/`)
  - Health endpoints
  - Products API (full CRUD)
  - Categories API (tree, CRUD)
  - Inventory API (reserve, adjust, transfer)
  - Auth/RBAC
  - Rate limiting

## Phase 12: Docker & OpenAPI

- [ ] **T046** Create Dockerfile (`backend/Dockerfile`)
  - Multi-stage from feature 005
  - Copy package.json, build, production image

- [ ] **T047** Create .dockerignore (`backend/.dockerignore`)

- [ ] **T048** Generate OpenAPI spec
  - Use @asteasolutions/zod-to-openapi
  - Generate from Zod schemas
  - Output: backend/docs/openapi.yaml

- [ ] **T049** Add Swagger UI (`/api/docs`)
  - Serve OpenAPI spec
  - Configure in app factory

## Phase 13: Verification

- [ ] **T050** Run full test suite
  - `pnpm test` - unit tests pass
  - `pnpm test:integration` - integration tests pass
  - `pnpm test:coverage` - >80% thresholds met

- [ ] **T051** TypeScript compilation
  - `pnpm typecheck` - no errors

- [ ] **T052** Linting
  - `pnpm lint` - no errors (ESLint + Prettier)

- [ ] **T053** Docker build test
  - `docker build -t catalog:test .`
  - `docker run -p 3000:3000 catalog:test`
  - Health checks pass

- [ ] **T054** Full stack integration
  - `docker compose up -d` (from feature 005)
  - All services healthy
  - API functional
  - Logs in Kibana
  - Metrics at /metrics

## Definition of Done
- [ ] All tasks completed
- [ ] Service runs standalone
- [ ] All 3 domains functional (products, categories, inventory)
- [ ] JSON and Prisma repositories work
- [ ] Event bus operational
- [ ] Observability: logs, metrics, traces
- [ ] Tests: unit + integration > 80% coverage
- [ ] Docker image builds and runs
- [ ] OpenAPI spec accurate
- [ ] Code review approved
- [ ] Documentation complete