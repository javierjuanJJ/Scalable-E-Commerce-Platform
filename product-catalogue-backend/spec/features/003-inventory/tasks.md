# Tasks: Inventory

## Phase 1: Domain & Validation (Foundation)

- [ ] **T001** Create TypeScript domain types (`backend/src/models/inventory.ts`)
  - Inventory, Location, Reservation, StockAdjustment, StockTransfer interfaces
  - InventoryStatus, ReservationStatus, AdjustmentReason, TransferStatus enums
  - Address, TransferItem types
  - Query params, input types

- [ ] **T002** Create Zod validation schemas (`backend/src/schemas/inventory.ts`)
  - adjustInventorySchema (array with reason enum)
  - reserveInventorySchema (array with expiresAt)
  - releaseReservationSchema (ids + reason)
  - confirmReservationSchema (ids + orderId)
  - createLocationSchema
  - transferSchema (from/to + items)
  - receiveTransferSchema
  - inventoryQuerySchema
  - inventoryParamsSchema

- [ ] **T003** Create repository interface (`backend/src/models/interfaces/IInventoryRepository.ts`)
  - All CRUD + transactions + queries
  - Reservation management
  - Location management
  - Transfer management
  - Adjustment audit trail

## Phase 2: JSON Repository (MVP)

- [ ] **T004** Create JSON repository (`backend/src/models/repositories/InventoryRepositoryJson.ts`)
  - Load/sync: inventory.json, reservations.json, adjustments.json, locations.json, transfers.json
  - In-memory indexes: productId+locationId, orderId, expiresAt
  - File locking (proper-lockfile)
  - Atomic transactions using write-ahead log pattern
  - Implement all IInventoryRepository methods

- [ ] **T005** Create inventory fixtures (`backend/tests/fixtures/inventory.json`, `locations.json`, `reservations.json`)
  - 3 locations (primary + 2 secondary)
  - Products with varying stock levels
  - Active/expired reservations
  - Adjustment history

- [ ] **T006** Write JSON repository unit tests (`backend/tests/unit/InventoryRepositoryJson.test.ts`)
  - Inventory CRUD
  - Atomic adjust (quantity + adjustment record)
  - Reserve/release/confirm flow
  - Transfer create/receive
  - Location CRUD
  - Expired reservation query
  - Concurrent access (file locking)

## Phase 3: Service Layer & Jobs

- [ ] **T007** Create transaction utilities (`backend/src/utils/transactions.ts`)
  - JSON: write-ahead log with rollback
  - Prisma: native transactions
  - Common interface

- [ ] **T008** Create InventoryService (`backend/src/services/InventoryService.ts`)
  - Adjust stock (with audit)
  - Reserve stock (check available, atomic)
  - Release reservation (by ID, with reason)
  - Confirm reservation (fulfill order)
  - Transfer stock (create + receive)
  - Location management
  - Event emission for all operations
  - Cache invalidation

- [ ] **T009** Write InventoryService unit tests (`backend/tests/unit/InventoryService.test.ts`)
  - Adjust (positive, negative, audit trail)
  - Reserve (success, insufficient stock, race condition)
  - Release (by ID, by order, expired)
  - Confirm (fulfill, double-confirm prevention)
  - Transfer (create, receive, cancel)
  - Location CRUD
  - Event emission verification
  - Cache invalidation verification

- [ ] **T010** Create Reservation Expiration Job (`backend/src/jobs/reservationExpiration.ts`)
  - Run every minute (configurable)
  - Find expired PENDING reservations
  - Release each (atomic: update inventory + reservation)
  - Emit inventory.released events
  - Metrics: processed, failed

- [ ] **T011** Create Low Stock Check Job (`backend/src/jobs/lowStockCheck.ts`)
  - Run daily at 6 AM (cron)
  - Check all inventory per location
  - Compare available vs threshold
  - Emit inventory.low_stock events
  - Deduplicate: only alert once per 24h per product/location

- [ ] **T012** Create Transfer Timeout Job (`backend/src/jobs/transferTimeout.ts`)
  - Run hourly
  - Find IN_TRANSIT > 7 days
  - Mark as OVERDUE
  - Alert admin (log/event)

- [ ] **T013** Write job unit tests (`backend/tests/unit/jobs/`)
  - Reservation expiration logic
  - Low stock threshold evaluation
  - Transfer timeout detection
  - Event emission verification

## Phase 4: Controller & Routes

- [ ] **T014** Create InventoryController (`backend/src/controllers/InventoryController.ts`)
  - Availability check (single + multi-location)
  - Adjust, reserve, release, confirm
  - Transfer create/receive
  - Location CRUD
  - Error handling (Zod, conflicts, not found)
  - Admin middleware for write operations

- [ ] **T015** Create inventory routes (`backend/src/routes/inventory.ts`)
  - GET /inventory/:productId
  - POST /inventory/adjust
  - POST /inventory/reserve
  - POST /inventory/release
  - POST /inventory/confirm
  - GET /inventory/locations
  - POST /inventory/locations
  - POST /inventory/transfer
  - POST /inventory/transfer/:id/receive
  - Request validation middleware

- [ ] **T016** Register routes in app (`backend/src/app.ts`)
  - Mount at `/api/v1/inventory`
  - Apply auth for admin routes

## Phase 5: Integration Tests

- [ ] **T017** Write API integration tests (`backend/tests/integration/inventory.api.test.ts`)
  - Availability check (single, multi-location)
  - Adjust stock (valid, invalid reason, audit trail)
  - Reserve (success, insufficient, concurrent)
  - Release (valid, expired, already released)
  - Confirm (valid, double confirm)
  - Transfer flow (create → receive)
  - Location CRUD
  - Authorization
  - Race condition stress test

## Phase 6: Prisma Integration (Production)

- [ ] **T018** Add models to Prisma schema (`backend/prisma/schema.prisma`)
  - Inventory (productId+locationId unique)
  - Location
  - Reservation (index on orderId, expiresAt)
  - StockAdjustment
  - StockTransfer + TransferItem
  - Relations and indexes

- [ ] **T019** Create Prisma repository (`backend/src/models/repositories/InventoryRepositoryPrisma.ts`)
  - Implement IInventoryRepository
  - Prisma transactions for all mutations
  - Optimistic locking with version
  - Efficient queries with indexes

- [ ] **T020** Write Prisma repository tests (`backend/tests/unit/InventoryRepositoryPrisma.test.ts`)
  - Same cases as JSON repo
  - Test transaction rollback
  - Test concurrent reservations (SELECT FOR UPDATE)

- [ ] **T021** Create migration script (`backend/scripts/migrate-inventory-json-to-prisma.ts`)
  - Inventory, locations, reservations, adjustments, transfers
  - Preserve all history
  - Verify counts and balances

- [ ] **T022** Add factory for repository selection (`backend/src/models/repositories/index.ts`)

## Phase 7: Cache & Event Integration

- [ ] **T023** Integrate Redis cache in InventoryService
  - Cache availability (30s TTL)
  - Cache product summary (60s TTL)
  - Cache locations (300s TTL)
  - Invalidate on all writes

- [ ] **T024** Add product event handlers
  - product.created → create inventory records (0 qty, all locations)
  - product.deleted → soft delete inventory

- [ ] **T025** Add cache invalidation tests
  - Verify cache cleared on adjust/reserve/release/confirm

## Phase 8: Observability

- [ ] **T026** Add structured logging (ECS format)
  - All mutations with before/after quantities
  - Reservation lifecycle
  - Job execution

- [ ] **T027** Add metrics (Prometheus)
  - Reservation latency histogram
  - Insufficient stock counter
  - Expired reservations counter
  - Low stock alerts counter
  - Transfer duration

- [ ] **T028** Add OpenTelemetry tracing
  - Transaction spans
  - Job spans
  - Correlate with order service

## Phase 9: Documentation & Polish

- [ ] **T029** Generate OpenAPI spec (`backend/docs/openapi.yaml`)
  - All endpoints with examples
  - Complex request bodies
  - Error response schemas

- [ ] **T030** Add Swagger UI integration

- [ ] **T031** Create feature README
  - Reservation flow diagram
  - Adjustment reasons reference
  - Job schedules

- [ ] **T032** Run full test suite
  - Unit > 80% coverage
  - Integration all pass
  - Race condition tests pass

- [ ] **T033** Docker build verification
  - Build succeeds
  - Jobs run in container
  - API functional

## Definition of Done
- [ ] All tasks completed and verified
- [ ] Tests pass in CI pipeline
- [ ] Code review approved
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Smoke tests pass