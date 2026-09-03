# Tasks: Product Listings

## Phase 1: Domain & Validation (Foundation)

- [ ] **T001** Create TypeScript domain types (`backend/src/models/product.ts`)
  - Product, ProductImage, Dimensions interfaces
  - ProductStatus enum
  - ProductQueryParams, PaginatedResult types
  - CreateProductInput, UpdateProductInput types

- [ ] **T002** Create Zod validation schemas (`backend/src/schemas/product.ts`)
  - createProductSchema (strict, required fields)
  - updateProductSchema (partial, optional fields)
  - productQuerySchema (pagination, sort, filters, search)
  - productParamsSchema (UUID validation)
  - Export inferred types

- [ ] **T003** Create repository interface (`backend/src/models/interfaces/IProductRepository.ts`)
  - Define all CRUD + search methods
  - Include pagination, filtering, sorting contracts
  - Version parameter for optimistic locking

## Phase 2: JSON Repository (MVP)

- [ ] **T004** Create JSON repository implementation (`backend/src/models/repositories/ProductRepositoryJson.ts`)
  - Load/sync products.json file
  - In-memory indexing for performance
  - File locking (use `proper-lockfile`)
  - Implement all IProductRepository methods

- [ ] **T005** Create product fixtures (`backend/tests/fixtures/products.json`)
  - 20+ sample products across categories
  - Various statuses, prices, stock levels
  - Images, tags, dimensions

- [ ] **T006** Write JSON repository unit tests (`backend/tests/unit/ProductRepositoryJson.test.ts`)
  - CRUD operations
  - Pagination, sorting
  - Search (name, description)
  - Filters (category, price, stock)
  - Optimistic locking (version conflicts)
  - Soft delete behavior

## Phase 3: Service Layer

- [ ] **T007** Create ProductService (`backend/src/services/ProductService.ts`)
  - Business logic orchestration
  - Validation via Zod schemas
  - Slug generation (unique)
  - SKU uniqueness check
  - Category existence validation
  - Event emission (created, updated, deleted)
  - Cache invalidation hooks

- [ ] **T008** Write ProductService unit tests (`backend/tests/unit/ProductService.test.ts`)
  - Create product (valid, invalid, duplicate SKU)
  - Update product (valid, version conflict, not found)
  - Delete product (soft delete, not found)
  - List products (all query combinations)
  - Get product details (with relations)
  - Event emission verification

## Phase 4: Controller & Routes

- [ ] **T009** Create ProductController (`backend/src/controllers/ProductController.ts`)
  - HTTP request/response handling
  - Query param parsing & validation
  - Response formatting (pagination envelope)
  - Error handling (Zod, not found, version conflict)
  - Admin-only middleware for write operations

- [ ] **T010** Create products routes (`backend/src/routes/products.ts`)
  - GET /products (list with query)
  - GET /products/:id (detail)
  - POST /products (create - admin)
  - PATCH /products/:id (update - admin)
  - DELETE /products/:id (delete - admin)
  - Request validation middleware

- [ ] **T011** Register routes in app (`backend/src/app.ts`)
  - Mount at `/api/v1/products`
  - Apply auth middleware for admin routes
  - Apply rate limiting

## Phase 5: Integration Tests

- [ ] **T012** Write API integration tests (`backend/tests/integration/products.api.test.ts`)
  - Full HTTP request/response cycle
  - All query param combinations
  - Validation error responses (422)
  - Not found (404)
  - Version conflict (409)
  - Admin authorization (401/403)
  - Pagination envelope format

## Phase 6: Prisma Integration (Production)

- [ ] **T013** Add Product model to Prisma schema (`backend/prisma/schema.prisma`)
  - Product model with all fields
  - Relations: Category, Inventory, ProductImage
  - Indexes: slug, sku, categoryId, status
  - Full-text search vector (PostgreSQL)

- [ ] **T014** Create Prisma repository (`backend/src/models/repositories/ProductRepositoryPrisma.ts`)
  - Implement IProductRepository
  - Prisma Client queries
  - Transaction support for create/update
  - Optimistic locking with version field

- [ ] **T015** Write Prisma repository tests (`backend/tests/unit/ProductRepositoryPrisma.test.ts`)
  - Same test cases as JSON repository
  - Use test database (Docker)
  - Test transactions, relations

- [ ] **T016** Create migration script (`backend/scripts/migrate-json-to-prisma.ts`)
  - Read products.json
  - Transform to Prisma create input
  - Batch insert with Prisma
  - Verify counts match

- [ ] **T017** Add DATABASE_PROVIDER factory (`backend/src/models/repositories/index.ts`)
  - Export factory function
  - Switch implementation based on env
  - Default to JSON for dev, Prisma for prod

## Phase 7: Caching & Search Enhancement

- [ ] **T018** Add Redis cache layer (`backend/src/services/CacheService.ts`)
  - Generic get/set/del/invalidate
  - Key prefixing: `catalog:products:`
  - TTL configuration via env

- [ ] **T019** Integrate cache in ProductService
  - Cache listings (key includes query hash)
  - Cache details (key by ID)
  - Invalidate on create/update/delete
  - Cache warming script

- [ ] **T020** Implement full-text search (Prisma)
  - Add tsvector column + GIN index
  - Prisma $queryRaw for search
  - Relevance ranking (ts_rank)
  - Fallback to JSON simple search

## Phase 8: Observability

- [ ] **T021** Add structured logging (ECS format)
  - Winston logger configuration
  - ECS field mapping
  - Request/response logging middleware
  - Service-level operation logging

- [ ] **T022** Add metrics (Prometheus)
  - Histograms for operation duration
  - Counters for errors by type
  - Gauge for cache hit ratio
  - /metrics endpoint

- [ ] **T023** Add OpenTelemetry tracing
  - Span for each service method
  - HTTP instrumentation
  - Database instrumentation
  - Trace context propagation

## Phase 9: Documentation & Polish

- [ ] **T024** Generate OpenAPI spec (`backend/docs/openapi.yaml`)
  - All endpoints with examples
  - Schema definitions
  - Error responses
  - Security schemes

- [ ] **T025** Add Swagger UI (`/api/docs`)
  - Serve OpenAPI spec
  - Interactive testing

- [ ] **T026** Create README for feature
  - API usage examples
  - Query parameter reference
  - Environment variables

- [ ] **T027** Run full test suite
  - Unit tests pass
  - Integration tests pass
  - Coverage > 80%

- [ ] **T028** Docker build verification
  - `docker compose build product-catalogue`
  - `docker compose up -d`
  - Health check passes
  - API accessible

## Definition of Done
- [ ] All tasks completed and verified
- [ ] Tests pass in CI pipeline
- [ ] Code review approved
- [ ] Documentation updated
- [ ] Deployed to staging environment
- [ ] Smoke tests pass in staging