# Spec: Develop Microservices (MVP)

## Feature Overview
**Feature ID**: 006
**Name**: Develop Microservices
**Description**: MVP implementation of the Product Catalog Service as a standalone microservice with inter-service communication patterns

## User Stories

### US-001: Service Skeleton
**As a** developer  
**I want** a complete service scaffold  
**So that** I can start implementing features immediately

**Acceptance Criteria**:
- Express 5 app with TypeScript strict mode
- Folder structure: routes, controllers, models, schemas, services, middleware, utils
- Health check endpoints: `/health` (liveness), `/ready` (readiness)
- Graceful shutdown (SIGTERM handling)
- Configuration via environment variables (Zod validated)
- Request ID middleware (UUID v4)
- CORS configured

### US-002: API Gateway Integration
**As a** developer  
**I want** the service to work behind an API gateway  
**So that** it's production-ready

**Acceptance Criteria**:
- Trust proxy headers (X-Forwarded-For, X-Forwarded-Proto)
- Rate limiting headers respected
- Path prefix stripping support (`/api/v1` → `/`)
- Request/response transformation hooks

### US-003: Inter-Service Communication
**As a** developer  
**I want** to call other services  
**So that** I can compose functionality

**Acceptance Criteria**:
- HTTP client with: retry, timeout, circuit breaker
- Service discovery via environment (static for MVP)
- Correlation ID propagation (traceparent)
- Error mapping to domain exceptions
- Client generated from OpenAPI spec (optional)

### US-004: Event-Driven Architecture
**As a** developer  
**I want** to publish/consume events  
**So that** services are loosely coupled

**Acceptance Criteria**:
- Event bus interface (in-memory for MVP, Kafka/RabbitMQ ready)
- Event types: ProductEvents, CategoryEvents, InventoryEvents
- Publisher: fire-and-forget with local persistence
- Consumer: at-least-once, idempotent handlers
- Dead letter queue for failed events
- Event schema validation (Zod)

### US-005: Database Abstraction
**As a** developer  
**I want** to swap JSON/Prisma without code changes  
**So that** MVP is fast, production is robust

**Acceptance Criteria**:
- Repository interfaces for all domains
- JSON implementation (files + indexes)
- Prisma implementation (PostgreSQL)
- Factory selects based on `DATABASE_PROVIDER`
- Migration script JSON → Prisma
- Transaction support in both

### US-006: Observability Built-In
**As a** developer  
**I want** metrics, logs, traces out of the box  
**So that** I don't add them later

**Acceptance Criteria**:
- Prometheus metrics: `/metrics` endpoint
- Standard metrics: http_requests_total, http_request_duration_seconds, nodejs_*
- Custom metrics: business events (products_created, inventory_reserved)
- OpenTelemetry tracing: auto-instrument HTTP, DB, Redis
- Structured logging (ECS) via feature 004
- Health checks expose dependency status

### US-007: Security Baseline
**As a** developer  
**I want** security defaults  
**So that** I don't introduce vulnerabilities

**Acceptance Criteria**:
- Helmet.js for security headers
- Rate limiting (express-rate-limit)
- Input validation on all endpoints (Zod)
- JWT authentication middleware (verify only, no issuance)
- RBAC middleware (roles: admin, user, service)
- Secrets never in code (Docker secrets / env)
- Dependency scanning in CI

### US-008: Testing Infrastructure
**As a** developer  
**I want** testing ready to go  
**So that** I write tests from day one

**Acceptance Criteria**:
- Node test runner configured (`node:test`)
- Test database: separate Postgres container
- Test utilities: factories, fixtures, supertest
- Coverage threshold: 80% branches
- Integration test helpers (seed, cleanup)
- Contract testing ready (Pact)

## Technical Specification

### Service Structure
```
backend/
├── src/
│   ├── app.ts                 # Express app factory
│   ├── server.ts              # Entry point, graceful shutdown
│   ├── config/
│   │   ├── index.ts           # Zod-validated config
│   │   └── env.schema.ts      # Environment schema
│   ├── middleware/
│   │   ├── requestId.ts       # UUID per request
│   │   ├── cors.ts            # CORS config
│   │   ├── helmet.ts          # Security headers
│   │   ├── rateLimit.ts       # Rate limiting
│   │   ├── auth.ts            # JWT verification
│   │   ├── rbac.ts            # Role-based access
│   │   ├── validation.ts      # Zod request validation
│   │   ├── errorHandler.ts    # Global error handler
│   │   └── metrics.ts         # Prometheus metrics
│   ├── routes/
│   │   ├── index.ts           # Route registration
│   │   ├── health.ts          # /health, /ready
│   │   ├── products.ts
│   │   ├── categories.ts
│   │   └── inventory.ts
│   ├── controllers/
│   │   ├── BaseController.ts
│   │   ├── ProductController.ts
│   │   ├── CategoryController.ts
│   │   └── InventoryController.ts
│   ├── services/
│   │   ├── EventBus.ts        # In-memory + adapter pattern
│   │   ├── ProductService.ts
│   │   ├── CategoryService.ts
│   │   └── InventoryService.ts
│   ├── models/
│   │   ├── interfaces/
│   │   │   ├── IProductRepository.ts
│   │   │   ├── ICategoryRepository.ts
│   │   │   └── IInventoryRepository.ts
│   │   ├── repositories/
│   │   │   ├── ProductRepositoryJson.ts
│   │   │   ├── ProductRepositoryPrisma.ts
│   │   │   └── factory.ts
│   │   └── index.ts
│   ├── schemas/
│   │   ├── product.ts
│   │   ├── category.ts
│   │   └── inventory.ts
│   ├── utils/
│   │   ├── logger.ts          # ECS logger (feature 004)
│   │   ├── httpClient.ts      # Resilient HTTP client
│   │   ├── tracing.ts         # OpenTelemetry setup
│   │   └── crypto.ts          # UUID, hash helpers
│   └── types/
│       ├── express.d.ts       # Extended Request/Response
│       └── events.ts          # Event types
├── prisma/
│   └── schema.prisma
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── fixtures/
│   └── utils/
├── package.json
├── tsconfig.json
└── .env.example
```

### Configuration Schema (Zod)

```typescript
// backend/src/config/env.schema.ts
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_VERSION: z.string().default('0.0.0'),
  
  // Database
  DATABASE_PROVIDER: z.enum(['json', 'prisma']).default('json'),
  DATABASE_URL: z.string().url().optional(),
  
  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  
  // Logging (Feature 004)
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOGSTASH_HOST: z.string().default('localhost'),
  LOGSTASH_PORT: z.coerce.number().default(5044),
  LOGSTASH_TLS: z.coerce.boolean().default(false),
  
  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('product-catalogue'),
  JWT_AUDIENCE: z.string().default('ecommerce-platform'),
  
  // External Services
  USERS_SERVICE_URL: z.string().url().optional(),
  ORDERS_SERVICE_URL: z.string().url().optional(),
  PAYMENTS_SERVICE_URL: z.string().url().optional(),
  
  // Feature Flags
  FEATURE_INVENTORY_RESERVATION: z.coerce.boolean().default(true),
  FEATURE_CATEGORY_TREE: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;
```

### Health Checks

```typescript
// GET /health - Liveness (k8s livenessProbe)
{ status: 'ok', version: '1.0.0', uptime: 12345 }

// GET /ready - Readiness (k8s readinessProbe)
{
  status: 'ready',
  checks: {
    database: { status: 'up', latency: 5 },
    redis: { status: 'up', latency: 2 },
    logstash: { status: 'up', latency: 10 }
  }
}
```

### Event Bus Interface

```typescript
interface EventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  subscribe<T extends DomainEvent>(eventType: string, handler: EventHandler<T>): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}

interface DomainEvent {
  eventId: string;           // UUID
  eventType: string;         // 'product.created'
  aggregateId: string;       // Product ID
  timestamp: Date;
  version: number;
  payload: unknown;
  metadata?: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
  };
}
```

### HTTP Client (Resilient)

```typescript
interface HttpClient {
  get<T>(url: string, options?: RequestOptions): Promise<T>;
  post<T>(url: string, body: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(url: string, body: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(url: string, options?: RequestOptions): Promise<T>;
}

interface RequestOptions {
  timeout?: number;           // Default 5000ms
  retries?: number;           // Default 3
  circuitBreaker?: boolean;   // Default true
  headers?: Record<string, string>;
  idempotencyKey?: string;
}
```

### Metrics (Prometheus)

```typescript
// Standard metrics (auto-collected)
http_requests_total{method, route, status_code}
http_request_duration_seconds{method, route, quantile}
nodejs_memory_heap_used_bytes
nodejs_eventloop_lag_seconds

// Custom business metrics
products_created_total{status}
inventory_reserved_total{product_id, status}
categories_tree_built_duration_seconds
```

## Implementation Steps

1. **Project Setup**: package.json, tsconfig.json, .env.example
2. **Config System**: Zod-validated environment configuration
3. **Express App Factory**: Middleware stack, route registration
4. **Health Endpoints**: /health, /ready with dependency checks
5. **Middleware Suite**: requestId, cors, helmet, rateLimit, auth, rbac, validation, errorHandler, metrics
6. **Repository Pattern**: Interfaces + JSON + Prisma implementations
7. **Event Bus**: In-memory with adapter for Kafka/RabbitMQ
8. **HTTP Client**: Retry, timeout, circuit breaker
9. **OpenTelemetry**: Tracing setup, auto-instrumentation
10. **Prometheus Metrics**: /metrics endpoint, custom metrics
11. **Testing Infrastructure**: Vitest/Node test config, fixtures, factories
12. **Docker Integration**: Multi-stage, compose, healthchecks
13. **Documentation**: API docs, architecture decisions

## Non-Functional Requirements

- **Startup Time**: < 3 seconds (production)
- **Memory**: < 256MB baseline
- **Cold Start**: < 500ms for first request
- **Throughput**: 1000 RPS on 1 CPU / 512MB
- **Availability**: 99.9% (single instance), 99.99% (multi-instance)

## Dependencies
- **001-product-listings**: Core domain
- **002-categories**: Core domain
- **003-inventory**: Core domain
- **004-centralized-logging**: ECS logging
- **005-docker-compose**: Containerization

## Out of Scope
- Service mesh (Istio/Linkerd)
- Distributed transactions (Saga pattern)
- Advanced deployment (ArgoCD, Flux)
- Multi-tenancy
- GraphQL federation