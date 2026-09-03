# Plan: Develop Microservices (MVP)

## Technical Approach

### Project Initialization
- **Package Manager**: pnpm (fast, disk-efficient, strict)
- **TypeScript**: Strict mode, ES2022 target, NodeNext modules
- **Express 5**: Beta/RC with new router, typed request/response
- **Node 22**: LTS, native test runner, fetch, WebSocket

### Configuration Management
- **Zod Schema**: Single source of truth for env vars
- **Validation at Startup**: Fail fast on invalid config
- **Type Inference**: `Env` type from schema
- **Defaults**: Sensible for development, required for production

### Middleware Stack (Order Matters)
1. `requestId` - Generate/extract UUID, attach to req/res
2. `cors` - Configured origins, credentials
3. `helmet` - Security headers (CSP, HSTS, etc.)
3. `rateLimit` - Per-IP, configurable windows
4. `auth` - JWT verification, attach user to req
5. `rbac` - Role checks for protected routes
6. `validation` - Zod schema validation (params, query, body)
7. `metrics` - Prometheus instrumentation
8. `errorHandler` - Global catch-all, structured errors

### Repository Pattern Implementation
**Interface Layer**: Pure TypeScript interfaces in `models/interfaces/`
**JSON Implementation**: File-based with in-memory indexes (MVP)
**Prisma Implementation**: PostgreSQL with Prisma Client (Production)
**Factory**: `getRepository()` returns correct impl based on `DATABASE_PROVIDER`

### Event Bus Architecture
**MVP**: In-memory EventEmitter with persistence to JSON file
**Production**: Adapter for Kafka/RabbitMQ
**Features**:
- Type-safe event publishing/consuming
- Idempotent handlers (deduplication via eventId)
- Dead letter queue for failed processing
- Replay capability for new consumers

### HTTP Client (Resilient)
- **Fetch-based**: Native Node 22 fetch
- **Retry**: Exponential backoff, configurable max
- **Timeout**: Per-request, default 5s
- **Circuit Breaker**: Failure threshold, half-open state
- **Correlation**: Auto-propagate traceparent header

### Observability Stack
- **Logging**: Winston + ECS (Feature 004)
- **Metrics**: Prometheus client, `/metrics` endpoint
- **Tracing**: OpenTelemetry JS, auto-instrument HTTP, DB, Redis
- **Health**: Liveness/readiness with dependency checks

### Testing Strategy
- **Unit**: Node test runner, isolated services/repositories
- **Integration**: Supertest against running app, test containers
- **Fixtures**: JSON files in `tests/fixtures/`
- **Factories**: Type-safe test data generators
- **Coverage**: 80% branches, 80% lines, 80% functions

## Implementation Steps

1. **Initialize Project**: package.json, tsconfig, .env.example
2. **Config System**: Zod schema, config loader, validation
3. **Express App**: Factory, middleware stack, router
4. **Health Endpoints**: /health, /ready with checks
5. **Middleware Suite**: All 9 middleware modules
6. **Domain Models**: Types, interfaces for Product, Category, Inventory
7. **Zod Schemas**: Validation for all domains
8. **JSON Repositories**: File-based implementations
9. **Services**: Business logic, events, cache
10. **Controllers**: Request/response handling
11. **Routes**: REST endpoints for all domains
12. **Event Bus**: In-memory + persistence
13. **HTTP Client**: Resilient client with circuit breaker
14. **Prisma Schema**: All models, relations, indexes
15. **Prisma Repositories**: Production implementations
16. **OpenTelemetry**: Tracing setup, propagators
17. **Prometheus Metrics**: Standard + custom
18. **Testing Setup**: Config, utilities, fixtures
19. **Docker Integration**: Multi-stage, compose
20. **Documentation**: OpenAPI, architecture

## File Structure
```
backend/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   ├── index.ts
│   │   └── env.schema.ts
│   ├── middleware/
│   │   ├── index.ts
│   │   ├── requestId.ts
│   │   ├── cors.ts
│   │   ├── helmet.ts
│   │   ├── rateLimit.ts
│   │   ├── auth.ts
│   │   ├── rbac.ts
│   │   ├── validation.ts
│   │   ├── errorHandler.ts
│   │   └── metrics.ts
│   ├── routes/
│   │   ├── index.ts
│   │   ├── health.ts
│   │   ├── products.ts
│   │   ├── categories.ts
│   │   └── inventory.ts
│   ├── controllers/
│   │   ├── BaseController.ts
│   │   ├── ProductController.ts
│   │   ├── CategoryController.ts
│   │   └── InventoryController.ts
│   ├── services/
│   │   ├── EventBus.ts
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
│   │   │   ├── CategoryRepositoryJson.ts
│   │   │   ├── InventoryRepositoryJson.ts
│   │   │   ├── ProductRepositoryPrisma.ts
│   │   │   ├── CategoryRepositoryPrisma.ts
│   │   │   ├── InventoryRepositoryPrisma.ts
│   │   │   └── factory.ts
│   │   └── index.ts
│   ├── schemas/
│   │   ├── product.ts
│   │   ├── category.ts
│   │   └── inventory.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── httpClient.ts
│   │   ├── tracing.ts
│   │   └── crypto.ts
│   └── types/
│       ├── express.d.ts
│       └── events.ts
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

## Configuration Details

### Environment Variables
```env
# App
NODE_ENV=development
PORT=3000
APP_VERSION=1.0.0

# Database
DATABASE_PROVIDER=json
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/catalog

# Redis
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=debug
LOGSTASH_HOST=localhost
LOGSTASH_PORT=5044
LOGSTASH_TLS=false

# Auth
JWT_SECRET=your-256-bit-secret-key-here-min-32-chars
JWT_ISSUER=product-catalogue
JWT_AUDIENCE=ecommerce-platform

# External Services
USERS_SERVICE_URL=http://localhost:3001
ORDERS_SERVICE_URL=http://localhost:3002
PAYMENTS_SERVICE_URL=http://localhost:3003

# Features
FEATURE_INVENTORY_RESERVATION=true
FEATURE_CATEGORY_TREE=true
```

## Testing Infrastructure

### Test Commands
```json
{
  "scripts": {
    "test": "node --test --test-name-pattern='unit'",
    "test:integration": "node --test --test-name-pattern='integration'",
    "test:coverage": "node --test --experimental-test-coverage",
    "test:watch": "node --test --watch"
  }
}
```

### Test Utilities
- `tests/utils/factories.ts` - createProduct, createCategory, createInventory
- `tests/utils/fixtures.ts` - loadFixtures, cleanupDatabase
- `tests/utils/httpClient.ts` - supertest wrapper with auth
- `tests/utils/eventBus.ts` - in-memory bus for tests

### Coverage Thresholds
```json
{
  "coverage": {
    "branches": 80,
    "functions": 80,
    "lines": 80,
    "statements": 80
  }
}
```

## Definition of Done
- [ ] Project initializes and runs
- [ ] All middleware functional
- [ ] Health endpoints return correct status
- [ ] JSON repositories implement all interfaces
- [ ] Prisma repositories implement all interfaces
- [ ] Factory switches correctly
- [ ] Event bus publishes/consumes
- [ ] HTTP client retries, times out, breaks circuit
- [ ] Metrics exposed at /metrics
- [ ] Traces generated for requests
- [ ] Unit tests pass (>80% coverage)
- [ ] Integration tests pass
- [ ] Docker build succeeds
- [ ] OpenAPI spec generated