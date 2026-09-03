# Plan: Product Listings

## Technical Approach

### Architecture
Follow the established layered pattern:
```
routes/products.ts       → HTTP handling, validation
controllers/products.ts  → Request/response orchestration
services/products.ts     → Business logic, orchestration
models/product.ts        → Data access (Repository pattern)
schemas/product.ts       → Zod validation schemas
```

### Database Strategy (JSON MVP → Prisma)
**Phase 1 (MVP - JSON)**:
- `backend/data/products.json` - flat file storage
- `ProductRepositoryJson` implements `IProductRepository`
- In-memory indexes for search/filter performance
- File locking for concurrent writes

**Phase 2 (Prisma/PostgreSQL)**:
- `prisma/schema.prisma` with Product, Category, Inventory models
- `ProductRepositoryPrisma` implements same `IProductRepository`
- Switch via environment variable `DATABASE_PROVIDER=json|prisma`
- Migration script: JSON → PostgreSQL

### Repository Interface
```typescript
interface IProductRepository {
  findAll(params: ProductQueryParams): Promise<PaginatedResult<Product>>;
  findById(id: string, includeDeleted?: boolean): Promise<Product | null>;
  findBySlug(slug: string): Promise<Product | null>;
  findBySku(sku: string): Promise<Product | null>;
  create(data: CreateProductInput): Promise<Product>;
  update(id: string, data: UpdateProductInput, version: number): Promise<Product>;
  softDelete(id: string): Promise<void>;
  existsByCategoryId(categoryId: string): Promise<boolean>;
}
```

### Search Implementation
**JSON MVP**: In-memory full-text search using `flexsearch` or simple string matching
**Prisma**: PostgreSQL `tsvector` + `GIN` index for full-text search

### Caching Strategy
- **Listings**: Redis cache with key `products:list:{hash(queryParams)}` TTL 60s
- **Details**: Redis cache with key `products:detail:{id}` TTL 300s
- **Invalidation**: On create/update/delete, invalidate relevant keys

### Validation Schemas (Zod)
- `createProductSchema` - strict, all required fields
- `updateProductSchema` - partial, optional fields
- `productQuerySchema` - query params validation
- `productParamsSchema` - UUID param validation

### Event Publishing
- Use `eventEmitter` (Node built-in) for MVP
- Later: Replace with message queue (RabbitMQ/Kafka)
- Events: `product.created`, `product.updated`, `product.deleted`

## API Design Details

### Pagination Response Format
```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

### Error Responses
```typescript
// 400 - Validation Error
{ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: ZodError[] } }

// 404 - Not Found
{ error: { code: "NOT_FOUND", message: "Product not found" } }

// 409 - Version Conflict
{ error: { code: "VERSION_CONFLICT", message: "Resource was modified by another user" } }

// 500 - Internal Error
{ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } }
```

## Implementation Steps

1. **Domain Models & Types**: Define TypeScript interfaces, enums
2. **Zod Schemas**: Request/response validation
3. **Repository Interface**: Contract for data access
4. **JSON Repository**: MVP implementation
5. **Service Layer**: Business logic, validation, events
6. **Controller**: Request handling, response formatting
7. **Routes**: Express router with middleware
8. **Tests**: Unit (service, repository), Integration (API)
9. **Prisma Schema**: Add Product model
10. **Prisma Repository**: Production implementation
11. **Cache Layer**: Redis integration
12. **Search Enhancement**: Full-text search
13. **Documentation**: OpenAPI/Swagger specs

## File Structure
```
backend/src/
├── schemas/
│   └── product.ts           # Zod schemas
├── models/
│   ├── interfaces/
│   │   └── IProductRepository.ts
│   ├── product.ts           # Domain types
│   ├── repositories/
│   │   ├── ProductRepositoryJson.ts
│   │   └── ProductRepositoryPrisma.ts
│   └── index.ts
├── services/
│   └── ProductService.ts
├── controllers/
│   └── ProductController.ts
├── routes/
│   └── products.ts
└── app.ts                   # Route registration
```

## Testing Strategy

### Unit Tests
- `ProductService.test.ts` - Business logic, validation, events
- `ProductRepositoryJson.test.ts` - CRUD, search, filter, pagination
- `ProductRepositoryPrisma.test.ts` - Same interface, different impl

### Integration Tests
- `products.api.test.ts` - Full HTTP request/response cycle
- Test all query param combinations
- Test validation errors
- Test optimistic locking

### Test Data
- Fixtures in `backend/tests/fixtures/products.json`
- Factory functions for generating test products

## Configuration

### Environment Variables
```env
DATABASE_PROVIDER=json|prisma
DATABASE_URL=postgresql://... (for Prisma)
REDIS_URL=redis://localhost:6379
CACHE_TTL_LIST=60
CACHE_TTL_DETAIL=300
SEARCH_MIN_CHARS=2
MAX_PAGE_LIMIT=100
DEFAULT_PAGE_LIMIT=20
```

## Migration Path (JSON → Prisma)

1. Add Prisma schema with Product model
2. Create `ProductRepositoryPrisma` implementing `IProductRepository`
3. Write migration script: read JSON → Prisma `createMany`
4. Feature flag: `DATABASE_PROVIDER=prisma`
5. Run both in parallel, compare results
6. Switch default to Prisma
7. Remove JSON repository (keep for reference)

## Monitoring & Observability

### Metrics
- `products.list.duration` - Histogram
- `products.list.errors` - Counter by error code
- `products.create.duration` - Histogram
- `products.cache.hit/miss` - Counters

### Logging (ECS Format)
```json
{
  "@timestamp": "2026-09-03T10:00:00.000Z",
  "service.name": "product-catalogue",
  "event.action": "product.list",
  "event.outcome": "success",
  "http.request.method": "GET",
  "url.path": "/api/v1/products",
  "user.id": "admin-123",
  "product.count": 20,
  "query.params": "{page:1,limit:20}"
}
```

### Tracing
- OpenTelemetry spans for each operation
- Propagate `traceparent` header
- Correlate logs with traces