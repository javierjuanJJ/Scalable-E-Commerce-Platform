# Plan: Inventory

## Technical Approach

### Architecture
```
routes/inventory.ts        → HTTP handling, validation
controllers/inventory.ts   → Request/response orchestration
services/inventory.ts      → Business logic, reservations, transactions
models/inventory.ts        → Data access (Repository pattern)
schemas/inventory.ts       → Zod validation schemas
jobs/inventory.ts          → Background jobs (expiration, low stock)
```

### Database Strategy (JSON MVP → Prisma)
**Phase 1 (JSON)**:
- `backend/data/inventory.json` - inventory records
- `backend/data/reservations.json` - active reservations
- `backend/data/adjustments.json` - audit trail
- `backend/data/locations.json` - warehouse locations
- `backend/data/transfers.json` - stock transfers
- In-memory indexes for fast lookups
- File locking for concurrent operations

**Phase 2 (Prisma)**:
- Prisma models: Inventory, Location, Reservation, StockAdjustment, StockTransfer
- Relations: Product ↔ Inventory, Location ↔ Inventory
- Transactions for all mutations
- Indexes: productId+locationId (unique), orderId, expiresAt

### Repository Interface
```typescript
interface IInventoryRepository {
  // Inventory
  findByProductAndLocation(productId: string, locationId: string): Promise<Inventory | null>;
  findByProductId(productId: string): Promise<Inventory[]>;
  findAll(params: InventoryQueryParams): Promise<PaginatedResult<Inventory>>;
  create(data: CreateInventoryInput): Promise<Inventory>;
  updateQuantity(id: string, delta: number, version: number): Promise<Inventory>;
  updateReserved(id: string, delta: number, version: number): Promise<Inventory>;
  adjustStock(data: AdjustStockInput): Promise<Inventory>; // Atomic quantity + adjustment record
  
  // Reservations
  createReservation(data: CreateReservationInput): Promise<Reservation>;
  findReservationById(id: string): Promise<Reservation | null>;
  findReservationsByOrder(orderId: string): Promise<Reservation[]>;
  findExpiredReservations(): Promise<Reservation[]>;
  updateReservationStatus(id: string, status: ReservationStatus, version: number): Promise<Reservation>;
  confirmReservation(id: string, version: number): Promise<Reservation>;
  releaseReservation(id: string, version: number): Promise<Reservation>;
  
  // Locations
  findAllLocations(): Promise<Location[]>;
  findLocationById(id: string): Promise<Location | null>;
  createLocation(data: CreateLocationInput): Promise<Location>;
  
  // Transfers
  createTransfer(data: CreateTransferInput): Promise<StockTransfer>;
  findTransferById(id: string): Promise<StockTransfer | null>;
  updateTransferStatus(id: string, status: TransferStatus): Promise<StockTransfer>;
  receiveTransferItems(transferId: string, items: ReceiveItemInput[]): Promise<StockTransfer>;
  
  // Adjustments (audit)
  createAdjustment(data: CreateAdjustmentInput): Promise<StockAdjustment>;
}
```

### Transaction Strategy
All write operations use transactions:
- **Adjust**: Update inventory + create adjustment record
- **Reserve**: Check available → decrement available/increment reserved + create reservation
- **Release/Confirm**: Update inventory + update reservation status
- **Transfer**: Decrement source + increment destination + create transfer record

### Background Jobs
1. **Reservation Expiration**: Every minute, find expired PENDING → RELEASED, update inventory
2. **Low Stock Check**: Daily at 6 AM, check all inventory, emit events
3. **Transfer Timeout**: Hourly, mark IN_TRANSIT > 7 days as overdue

### Caching Strategy
- **Availability**: Redis `catalog:inventory:avail:{productId}:{locationId}` TTL 30s
- **Product Summary**: `catalog:inventory:summary:{productId}` TTL 60s
- **Locations**: `catalog:inventory:locations` TTL 300s
- **Invalidation**: On any write to inventory/reservations

### Validation Schemas (Zod)
- `adjustInventorySchema` - array of adjustments with reasons
- `reserveInventorySchema` - array of reservations with expiry
- `releaseReservationSchema` - IDs + reason
- `confirmReservationSchema` - IDs + orderId
- `transferSchema` - from/to + items
- `locationSchema` - create location

### Event Handling
- **Publish**: All inventory events via EventEmitter
- **Consume**: product.created (create inventory), product.deleted (soft delete)
- **Handlers**: Async, non-blocking, with retry logic

## API Design Details

### Availability Response
```typescript
interface AvailabilityResponse {
  productId: string;
  locationId: string;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  status: InventoryStatus;
  locations?: LocationAvailability[];
}

interface LocationAvailability {
  locationId: string;
  locationCode: string;
  quantity: number;
  reserved: number;
  available: number;
}
```

### Error Responses
```typescript
// 400 - Validation
{ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: [] } }

// 404 - Not Found
{ error: { code: "NOT_FOUND", message: "Inventory not found for product" } }

// 409 - Conflict
{ error: { code: "INSUFFICIENT_STOCK", message: "Only 5 available, requested 10", details: { available: 5, requested: 10 } } }
{ error: { code: "VERSION_CONFLICT", message: "Inventory was modified by another operation" } }
{ error: { code: "RESERVATION_EXPIRED", message: "Reservation has expired" } }
{ error: { code: "RESERVATION_ALREADY_CONFIRMED", message: "Reservation already confirmed" } }

// 422 - Business Rule
{ error: { code: "INVALID_TRANSFER", message: "Source and destination locations must be different" } }
```

## Implementation Steps

1. **Domain Models**: Inventory, Location, Reservation, Adjustment, Transfer types
2. **Zod Schemas**: All request/response validation
3. **Repository Interface**: Contract for data access
4. **JSON Repository**: MVP with file-based storage
5. **Service Layer**: Core logic, transactions, events
6. **Background Jobs**: Expiration, low stock, transfer timeout
7. **Controller**: HTTP handling, response formatting
8. **Routes**: Express router with all endpoints
9. **Tests**: Unit (service, repo, jobs), Integration (API)
10. **Prisma Schema**: All models with relations
11. **Prisma Repository**: Production implementation
12. **Cache Integration**: Redis with invalidation
13. **Documentation**: OpenAPI specs

## File Structure
```
backend/src/
├── schemas/
│   └── inventory.ts
├── models/
│   ├── interfaces/
│   │   └── IInventoryRepository.ts
│   ├── inventory.ts
│   ├── repositories/
│   │   ├── InventoryRepositoryJson.ts
│   │   └── InventoryRepositoryPrisma.ts
│   └── index.ts
├── services/
│   └── InventoryService.ts
├── controllers/
│   └── InventoryController.ts
├── routes/
│   └── inventory.ts
├── jobs/
│   ├── reservationExpiration.ts
│   ├── lowStockCheck.ts
│   └── transferTimeout.ts
└── utils/
    └── transactions.ts          # Transaction helpers
```

## Testing Strategy

### Unit Tests
- `InventoryService.test.ts` - Adjust, reserve, release, confirm, transfer
- `InventoryRepositoryJson.test.ts` - CRUD, transactions, queries
- `ReservationExpirationJob.test.ts` - Expiry logic, inventory restoration
- `LowStockCheckJob.test.ts` - Threshold evaluation, event emission
- `transactions.test.ts` - Atomic operations

### Integration Tests
- `inventory.api.test.ts` - All endpoints
- Concurrent reservation attempts (race conditions)
- Reservation expiry flow
- Transfer flow (pending → received)
- Low stock alert generation

### Test Data
- Fixtures: Products with inventory across 3 locations
- Reservations in various states
- Adjustments history

## Configuration

### Environment Variables
```env
RESERVATION_TTL_MINUTES=15
RESERVATION_EXPIRY_JOB_INTERVAL=60000
LOW_STOCK_CHECK_CRON="0 6 * * *"
LOW_STOCK_DEFAULT_THRESHOLD=10
TRANSFER_TIMEOUT_DAYS=7
CACHE_TTL_AVAILABILITY=30
CACHE_TTL_SUMMARY=60
CACHE_TTL_LOCATIONS=300
```

## Migration Path (JSON → Prisma)

1. Add all models to Prisma schema
2. Create Prisma repository
3. Migration script: JSON → Prisma (preserve adjustment history)
4. Feature flag switch
5. Parallel verification
6. Remove JSON implementation

## Monitoring & Observability

### Metrics
- `inventory.reserve.duration` - Reservation latency
- `inventory.reserve.conflicts` - Insufficient stock counter
- `inventory.reservation.expiry` - Expired reservations counter
- `inventory.low_stock.alerts` - Low stock events
- `inventory.transfer.duration` - Transfer completion time

### Logging (ECS)
```json
{
  "service.name": "product-catalogue",
  "event.action": "inventory.reserve",
  "event.outcome": "success",
  "product.id": "uuid",
  "location.id": "uuid",
  "quantity": 2,
  "order.id": "uuid",
  "reservation.id": "uuid",
  "available.after": 83
}
```

### Tracing
- Spans for each transaction (reserve, adjust, transfer)
- Reservation expiry job spans
- Correlate with order service traces