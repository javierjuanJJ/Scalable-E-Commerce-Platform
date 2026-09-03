# Spec: Inventory

## Feature Overview
**Feature ID**: 003
**Name**: Inventory
**Description**: Stock management, reservations, and availability tracking for products with multi-location support

## User Stories

### US-001: Check Stock Availability
**As a** customer  
**I want to** see real-time stock status  
**So that** I know if product is purchasable

**Acceptance Criteria**:
- GET `/api/v1/inventory/:productId` returns availability
- Fields: productId, quantity, available, reserved, status
- Status: IN_STOCK, LOW_STOCK, OUT_OF_STOCK, PRE_ORDER
- Low stock threshold configurable (default: 10)
- Include location breakdown if multi-location

### US-002: Adjust Stock (Admin)
**As an** admin  
**I want to** adjust inventory levels  
**So that** stock reflects reality

**Acceptance Criteria**:
- POST `/api/v1/inventory/adjust` with adjustments
- Body: [{ productId, locationId?, quantity, reason, referenceId? }]
- Positive = addition, negative = removal
- Reason enum: RECEIPT, RETURN, DAMAGE, THEFT, COUNT_CORRECTION, OTHER
- Returns updated inventory records
- Emits `inventory.adjusted` event

### US-003: Reserve Stock (Order Service)
**As an** order service  
**I want to** reserve stock for pending orders  
**So that** items aren't oversold

**Acceptance Criteria**:
- POST `/api/v1/inventory/reserve` with reservations
- Body: [{ productId, locationId?, quantity, orderId, expiresAt }]
- Decrements available, increments reserved
- Auto-expire reservations (background job)
- Returns reservation records with IDs
- Emits `inventory.reserved` event

### US-004: Release Reservation (Order Service)
**As an** order service  
**I want to** release expired/cancelled reservations  
**So that** stock returns to available

**Acceptance Criteria**:
- POST `/api/v1/inventory/release` with reservation IDs
- Body: { reservationIds: string[], reason: string }
- Increments available, decrements reserved
- Reason: EXPIRED, CANCELLED, FULFILLED
- Emits `inventory.released` event

### US-005: Confirm Reservation (Order Service)
**As an** order service  
**I want to** confirm reservation on order completion  
**So that** stock is permanently decremented

**Acceptance Criteria**:
- POST `/api/v1/inventory/confirm` with reservation IDs
- Body: { reservationIds: string[], orderId }
- Decrements reserved and quantity (fulfilled)
- Emits `inventory.confirmed` event

### US-006: Multi-Location Inventory
**As an** admin  
**I want to** manage stock across warehouses  
**So that** fulfillment is optimized

**Acceptance Criteria**:
- Locations: id, name, code, address, isPrimary
- Inventory per product per location
- GET `/api/v1/inventory/locations` lists locations
- POST `/api/v1/inventory/locations` creates location
- Transfers between locations (separate endpoint)

### US-007: Stock Transfer (Admin)
**As an** admin  
**I want to** transfer stock between locations  
**So that** inventory is balanced

**Acceptance Criteria**:
- POST `/api/v1/inventory/transfer`
- Body: { fromLocationId, toLocationId, items: [{ productId, quantity }] }
- Creates pending transfer
- POST `/api/v1/inventory/transfer/:id/receive` to complete
- Emits `inventory.transferred` event

### US-008: Low Stock Alerts
**As an** admin  
**I want to** be notified of low stock  
**So that** I can reorder

**Acceptance Criteria**:
- Background job checks daily
- Emits `inventory.low_stock` for products below threshold
- Configurable threshold per product (default 10)
- Includes location breakdown

## Data Model

### Inventory Entity
```typescript
interface Inventory {
  id: string;                    // UUID
  productId: string;             // FK to Product
  product?: Product;             // Populated on include
  locationId: string;            // FK to Location
  location?: Location;           // Populated on include
  quantity: number;              // Total physical stock
  reserved: number;              // Reserved for orders
  available: number;             // Computed: quantity - reserved
  lowStockThreshold: number;     // Alert threshold (default 10)
  status: InventoryStatus;       // Computed from available
  version: number;               // Optimistic lock
  createdAt: Date;
  updatedAt: Date;
}

interface Location {
  id: string;
  code: string;                  // Short code (WH01, WH02)
  name: string;
  address: Address;
  isPrimary: boolean;            // Default fulfillment location
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

enum InventoryStatus {
  IN_STOCK = 'IN_STOCK',         // available > threshold
  LOW_STOCK = 'LOW_STOCK',       // 0 < available <= threshold
  OUT_OF_STOCK = 'OUT_OF_STOCK', // available = 0
  PRE_ORDER = 'PRE_ORDER'        // available < 0 (backorder allowed)
}

interface Reservation {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  orderId: string;
  status: ReservationStatus;     // PENDING, CONFIRMED, RELEASED, EXPIRED
  expiresAt: Date;               // Auto-release deadline
  createdAt: Date;
  updatedAt: Date;
}

enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED'
}

interface StockAdjustment {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;              // Positive or negative
  previousQuantity: number;
  newQuantity: number;
  reason: AdjustmentReason;
  referenceId?: string;          // PO#, RMA#, etc.
  notes?: string;
  createdBy: string;
  createdAt: Date;
}

enum AdjustmentReason {
  RECEIPT = 'RECEIPT',
  RETURN = 'RETURN',
  DAMAGE = 'DAMAGE',
  THEFT = 'THEFT',
  COUNT_CORRECTION = 'COUNT_CORRECTION',
  OTHER = 'OTHER'
}

interface StockTransfer {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  status: TransferStatus;        // PENDING, IN_TRANSIT, RECEIVED, CANCELLED
  items: TransferItem[];
  referenceId?: string;
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}

interface TransferItem {
  productId: string;
  quantity: number;
  receivedQuantity?: number;
}
```

## API Specification

### GET /api/v1/inventory/:productId
**Query**: `?locationId=` (optional, default: primary)
**Response 200**:
```json
{
  "productId": "uuid",
  "locationId": "uuid",
  "quantity": 100,
  "reserved": 15,
  "available": 85,
  "lowStockThreshold": 10,
  "status": "IN_STOCK",
  "locations": [
    { "locationId": "uuid", "quantity": 60, "reserved": 10, "available": 50 },
    { "locationId": "uuid", "quantity": 40, "reserved": 5, "available": 35 }
  ]
}
```

### POST /api/v1/inventory/adjust
**Request Body**:
```json
{
  "adjustments": [
    {
      "productId": "uuid",
      "locationId": "uuid",
      "quantity": 50,
      "reason": "RECEIPT",
      "referenceId": "PO-12345",
      "notes": "New shipment received"
    }
  ]
}
```
**Response 200**: Array of updated Inventory

### POST /api/v1/inventory/reserve
**Request Body**:
```json
{
  "reservations": [
    {
      "productId": "uuid",
      "locationId": "uuid",
      "quantity": 2,
      "orderId": "order-uuid",
      "expiresAt": "2026-09-04T10:00:00Z"
    }
  ]
}
```
**Response 201**: Array of Reservations

### POST /api/v1/inventory/release
**Request Body**:
```json
{
  "reservationIds": ["uuid1", "uuid2"],
  "reason": "CANCELLED"
}
```
**Response 200**: Released count

### POST /api/v1/inventory/confirm
**Request Body**:
```json
{
  "reservationIds": ["uuid1"],
  "orderId": "order-uuid"
}
```
**Response 200**: Confirmed count

### GET /api/v1/inventory/locations
**Response 200**: Location[]

### POST /api/v1/inventory/locations
**Request Body**: Location (without id, createdAt, updatedAt)
**Response 201**: Location

### POST /api/v1/inventory/transfer
**Request Body**:
```json
{
  "fromLocationId": "uuid",
  "toLocationId": "uuid",
  "items": [{ "productId": "uuid", "quantity": 10 }],
  "referenceId": "TRF-001"
}
```
**Response 201**: StockTransfer

### POST /api/v1/inventory/transfer/:id/receive
**Request Body**:
```json
{
  "items": [{ "productId": "uuid", "receivedQuantity": 10 }]
}
```
**Response 200**: Updated StockTransfer

## Business Rules

1. **Available = Quantity - Reserved** (always computed)
2. **Reservations Expire**: Background job releases expired (default 15 min)
3. **No Oversell**: Reserve fails if available < requested
4. **Atomic Operations**: Adjust/Reserve/Release/Confirm use transactions
5. **Location Default**: Primary location used if not specified
6. **Transfer Flow**: PENDING → IN_TRANSIT → RECEIVED
7. **Low Stock**: Evaluated per location, aggregated for product
8. **Backorders**: PRE_ORDER status allows negative available (configurable)

## Events Published

| Event | Payload | Description |
|-------|---------|-------------|
| `inventory.adjusted` | StockAdjustment[] | Manual adjustments |
| `inventory.reserved` | Reservation[] | Stock reserved |
| `inventory.released` | { reservationIds, reason } | Reservation released |
| `inventory.confirmed` | { reservationIds, orderId } | Order fulfilled |
| `inventory.transferred` | StockTransfer | Transfer completed |
| `inventory.low_stock` | { productId, locationId, available } | Below threshold |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| `product.created` | Product Listings | Create inventory record (0 qty) |
| `product.deleted` | Product Listings | Soft delete inventory |

## Non-Functional Requirements

- **Consistency**: Strong consistency for reservations (ACID)
- **Latency**: P95 < 50ms for availability check
- **Throughput**: 500 RPS for reserve/release
- **Expiration Job**: Runs every minute, processes 1000/sec
- **Audit Trail**: All adjustments logged with user, reason, reference

## Dependencies
- **001-product-listings**: Product must exist
- **004-centralized-logging**: All operations logged
- **005-docker-compose**: Service containerized
- **006-develop-microservices**: Inter-service communication

## Out of Scope
- Demand forecasting
- Automated reorder points
- Supplier management
- Batch/lot tracking
- Serial number tracking