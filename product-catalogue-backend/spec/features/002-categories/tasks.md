# Tasks: Categories

## Phase 1: Domain & Validation (Foundation)

- [ ] **T001** Create TypeScript domain types (`backend/src/models/category.ts`)
  - Category, CategoryTreeNode, Breadcrumb interfaces
  - CategoryStatus enum
  - CategoryQueryParams, CreateCategoryInput, UpdateCategoryInput

- [ ] **T002** Create Zod validation schemas (`backend/src/schemas/category.ts`)
  - createCategorySchema (name required, parentId optional)
  - updateCategorySchema (partial, custom refine for circular check)
  - categoryQuerySchema (flat, includeProductCount, filters)
  - reorderSchema (array of {id, sortOrder})
  - categoryParamsSchema (UUID)
  - slugParamsSchema (string)

- [ ] **T003** Create repository interface (`backend/src/models/interfaces/ICategoryRepository.ts`)
  - All CRUD + tree + ancestry methods
  - Product count updates
  - Existence checks (products, children)

## Phase 2: JSON Repository (MVP)

- [ ] **T004** Create tree utilities (`backend/src/utils/tree.ts`)
  - buildTree(flat: Category[]): CategoryTreeNode[]
  - getAncestors(flat, id): Category[]
  - getDescendants(flat, id): Category[]
  - getPath(flat, id): string (materialized path)
  - validateMove(flat, categoryId, newParentId): boolean
  - generateSlug(name, siblings): string (unique)

- [ ] **T005** Create JSON repository (`backend/src/models/repositories/CategoryRepositoryJson.ts`)
  - Load/sync categories.json
  - Implement all ICategoryRepository methods
  - Materialized path on create/update
  - File locking for concurrent writes

- [ ] **T006** Create category fixtures (`backend/tests/fixtures/categories.json`)
  - 3-level hierarchy (5 root, 15 children, 30 grandchildren)
  - Various statuses, sort orders
  - Some with products (for count testing)

- [ ] **T007** Write JSON repository unit tests (`backend/tests/unit/CategoryRepositoryJson.test.ts`)
  - CRUD operations
  - Tree building (flat → tree)
  - Ancestry/descendant queries
  - Materialized path generation
  - Move validation (circular prevention)
  - Reorder functionality
  - Slug uniqueness within parent
  - Product count updates

## Phase 3: Service Layer

- [ ] **T008** Create CategoryService (`backend/src/services/CategoryService.ts`)
  - Business logic orchestration
  - Slug generation with uniqueness
  - Circular reference prevention
  - Max depth enforcement (5 levels)
  - Status inheritance (inactive parent hides children)
  - Event emission (created, updated, deleted, reordered)
  - Cache invalidation
  - Product count synchronization via event handlers

- [ ] **T009** Write CategoryService unit tests (`backend/tests/unit/CategoryService.test.ts`)
  - Create category (root, child, slug collision)
  - Update category (move, rename, status change)
  - Delete category (soft, force with migration)
  - Reorder siblings
  - Get tree (cached, fresh)
  - Get by slug (with parent context)
  - Breadcrumbs generation
  - Event emission verification
  - Cache invalidation verification

## Phase 4: Controller & Routes

- [ ] **T010** Create CategoryController (`backend/src/controllers/CategoryController.ts`)
  - Tree vs flat response formatting
  - Query param parsing
  - Breadcrumb construction
  - Error handling (Zod, not found, conflicts)
  - Admin middleware for write operations

- [ ] **T011** Create categories routes (`backend/src/routes/categories.ts`)
  - GET /categories (tree/flat)
  - GET /categories/:id (detail + products)
  - GET /categories/slug/:slug
  - POST /categories (admin)
  - PATCH /categories/:id (admin)
  - DELETE /categories/:id (admin)
  - PATCH /categories/reorder (admin)
  - Request validation middleware

- [ ] **T012** Register routes in app (`backend/src/app.ts`)
  - Mount at `/api/v1/categories`
  - Apply auth for admin routes

## Phase 5: Integration Tests

- [ ] **T013** Write API integration tests (`backend/tests/integration/categories.api.test.ts`)
  - Tree response structure
  - Flat list with filters
  - Slug lookup
  - Category with products pagination
  - Breadcrumbs
  - Create/update/delete (admin)
  - Circular reference rejection
  - Force delete product migration
  - Reorder validation
  - Authorization checks

## Phase 6: Prisma Integration (Production)

- [ ] **T014** Add Category model to Prisma schema (`backend/prisma/schema.prisma`)
  - Self-referential relation (parent/children)
  - Materialized path field
  - Indexes: parentId, path, slug+parentId (unique)
  - Product count fields

- [ ] **T015** Create Prisma repository (`backend/src/models/repositories/CategoryRepositoryPrisma.ts`)
  - Implement ICategoryRepository
  - Recursive CTE for tree/ancestry
  - Transaction for move + path update
  - Optimistic locking

- [ ] **T016** Write Prisma repository tests (`backend/tests/unit/CategoryRepositoryPrisma.test.ts`)
  - Same cases as JSON repo
  - Test recursive queries
  - Test transaction rollback

- [ ] **T017** Create migration script (`backend/scripts/migrate-categories-json-to-prisma.ts`)
  - Read categories.json
  - Compute materialized paths
  - Batch insert preserving hierarchy
  - Verify tree structure

- [ ] **T018** Add factory for repository selection (`backend/src/models/repositories/index.ts`)
  - Switch based on DATABASE_PROVIDER

## Phase 7: Event Handling & Cache

- [ ] **T019** Add product event handlers in CategoryService
  - Handle product.created → increment count
  - Handle product.deleted → decrement count
  - Handle product.updated (categoryId change) → adjust both

- [ ] **T020** Integrate Redis cache
  - Cache tree, flat list, details
  - Invalidate on any write
  - Cache warming on startup

- [ ] **T021** Add cache invalidation tests
  - Verify cache cleared on create/update/delete
  - Verify stale data not served

## Phase 8: Observability

- [ ] **T022** Add structured logging (ECS format)
  - Tree fetch, detail fetch, mutations
  - Move validation details
  - Cache hit/miss

- [ ] **T023** Add metrics
  - Tree build duration
  - Move validation duration
  - Cache hit ratio
  - Event processing lag

- [ ] **T024** Add OpenTelemetry tracing
  - Tree building spans
  - Ancestry check spans
  - Event handler spans

## Phase 9: Documentation & Polish

- [ ] **T025** Generate OpenAPI spec (`backend/docs/openapi.yaml`)
  - All endpoints with tree/flat examples
  - Error response schemas
  - Query parameter documentation

- [ ] **T026** Add Swagger UI integration

- [ ] **T027** Create feature README
  - API usage examples
  - Tree vs flat usage
  - Slug conventions

- [ ] **T028** Run full test suite
  - Unit > 80% coverage
  - Integration all pass

- [ ] **T029** Docker build verification
  - Build succeeds
  - Health check passes
  - API functional in container

## Definition of Done
- [ ] All tasks completed and verified
- [ ] Tests pass in CI pipeline
- [ ] Code review approved
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Smoke tests pass