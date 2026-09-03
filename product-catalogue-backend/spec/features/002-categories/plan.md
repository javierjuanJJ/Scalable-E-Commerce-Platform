# Plan: Categories

## Technical Approach

### Architecture
```
routes/categories.ts       → HTTP handling, validation
controllers/categories.ts  → Request/response orchestration
services/categories.ts     → Business logic, tree operations
models/category.ts         → Data access (Repository pattern)
schemas/category.ts        → Zod validation schemas
```

### Database Strategy (JSON MVP → Prisma)
**Phase 1 (JSON)**:
- `backend/data/categories.json` - flat array with parentId
- `CategoryRepositoryJson` with tree-building utilities
- Materialized path computed on write
- In-memory tree cache

**Phase 2 (Prisma)**:
- Prisma model with recursive relation
- `@@index([parentId])`, `@@index([path])`
- Raw SQL for recursive CTE tree queries
- Materialized path stored for fast ancestry

### Repository Interface
```typescript
interface ICategoryRepository {
  findAll(params: CategoryQueryParams): Promise<Category[] | PaginatedResult<Category>>;
  findTree(): Promise<CategoryTreeNode[]>;
  findById(id: string, includeDeleted?: boolean): Promise<Category | null>;
  findBySlug(slug: string, parentId?: string): Promise<Category | null>;
  findByPath(path: string): Promise<Category | null>;
  findChildren(parentId: string): Promise<Category[]>;
  findDescendants(ancestorId: string): Promise<Category[]>;
  findAncestors(categoryId: string): Promise<Category[]>;
  create(data: CreateCategoryInput): Promise<Category>;
  update(id: string, data: UpdateCategoryInput, version: number): Promise<Category>;
  softDelete(id: string, force?: boolean): Promise<void>;
  reorder(items: { id: string; sortOrder: number }[]): Promise<Category[]>;
  updateProductCount(categoryId: string, delta: number): Promise<void>;
  hasProducts(categoryId: string): Promise<boolean>;
  hasChildren(categoryId: string): Promise<boolean>;
}
```

### Tree Operations
- **Build Tree**: Recursive function from flat list (O(n))
- **Materialized Path**: `/root-id/parent-id/current-id/` on create/update
- **Ancestry**: `path LIKE '/root/%/current/%'` for descendants
- **Move Prevention**: Check if new parent is self or descendant

### Caching Strategy
- **Tree Cache**: Redis key `catalog:categories:tree` TTL 300s
- **Flat List**: `catalog:categories:flat:{status}` TTL 60s
- **Detail**: `catalog:categories:detail:{id}` TTL 300s
- **Invalidation**: On any write, invalidate all category caches

### Validation Schemas (Zod)
- `createCategorySchema` - name required, parentId optional UUID
- `updateCategorySchema` - partial, prevent circular moves
- `categoryQuerySchema` - flat, includeProductCount, filters
- `reorderSchema` - array of {id, sortOrder}

### Event Handling
- **Publish**: category.created, updated, deleted, reordered
- **Consume**: product.created, deleted, updated (categoryId change)
- **Handler**: Update cached productCount atomically

## API Design Details

### Tree Response Format
```typescript
interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  productCount: number;
  children: CategoryTreeNode[];
}
```

### Breadcrumb Format
```typescript
interface Breadcrumb {
  id: string;
  name: string;
  slug: string;
}
```

### Error Responses
```typescript
// 400 - Validation
{ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: [] } }

// 404 - Not Found
{ error: { code: "NOT_FOUND", message: "Category not found" } }

// 409 - Conflict
{ error: { code: "CONFLICT", message: "Category has products. Use force=true to delete." } }
{ error: { code: "CIRCULAR_REFERENCE", message: "Cannot move category to its own descendant" } }

// 422 - Business Rule
{ error: { code: "MAX_DEPTH_EXCEEDED", message: "Maximum category depth is 5" } }
```

## Implementation Steps

1. **Domain Models**: Category, CategoryTreeNode, Breadcrumb types
2. **Zod Schemas**: Request/response validation
3. **Repository Interface**: Contract for data access
4. **JSON Repository**: MVP with tree utilities
5. **Service Layer**: Tree logic, events, cache
6. **Controller**: HTTP handling, tree vs flat
7. **Routes**: Express router with all endpoints
8. **Tests**: Unit (service, repo), Integration (API)
9. **Prisma Schema**: Category model with recursive relation
10. **Prisma Repository**: Production implementation
11. **Event Handlers**: Product count synchronization
12. **Cache Integration**: Redis with invalidation
13. **Documentation**: OpenAPI specs

## File Structure
```
backend/src/
├── schemas/
│   └── category.ts
├── models/
│   ├── interfaces/
│   │   └── ICategoryRepository.ts
│   ├── category.ts              # Domain types
│   ├── repositories/
│   │   ├── CategoryRepositoryJson.ts
│   │   └── CategoryRepositoryPrisma.ts
│   └── index.ts
├── services/
│   └── CategoryService.ts
├── controllers/
│   └── CategoryController.ts
├── routes/
│   └── categories.ts
└── utils/
    └── tree.ts                  # Tree building utilities
```

## Testing Strategy

### Unit Tests
- `CategoryService.test.ts` - Tree building, move validation, slug generation
- `CategoryRepositoryJson.test.ts` - CRUD, tree, ancestry, reorder
- `CategoryRepositoryPrisma.test.ts` - Same interface
- `tree.test.ts` - Pure tree utilities

### Integration Tests
- `categories.api.test.ts` - All endpoints
- Tree vs flat responses
- Slug uniqueness within parent
- Circular reference prevention
- Force delete with product migration
- Reorder validation

### Test Data
- Fixtures: 3-level hierarchy (Electronics → Phones → Smartphones)
- Products distributed across levels

## Configuration

### Environment Variables
```env
MAX_CATEGORY_DEPTH=5
CATEGORY_TREE_CACHE_TTL=300
CATEGORY_FLAT_CACHE_TTL=60
CATEGORY_DETAIL_CACHE_TTL=300
DEFAULT_SORT_ORDER=0
```

## Migration Path (JSON → Prisma)

1. Add Category model to Prisma schema
2. Create Prisma repository implementation
3. Migration script: JSON → Prisma (preserve paths)
4. Feature flag switch
5. Parallel run verification
6. Remove JSON implementation

## Monitoring & Observability

### Metrics
- `categories.tree.build.duration` - Tree construction time
- `categories.move.validation.duration` - Circular check time
- `categories.cache.hit/miss` - Cache effectiveness
- `categories.product_count.sync` - Event processing lag

### Logging (ECS)
```json
{
  "service.name": "product-catalogue",
  "event.action": "category.tree.fetch",
  "event.outcome": "success",
  "category.count": 45,
  "category.max_depth": 3,
  "cache.hit": true
}
```

### Tracing
- Spans for tree building (recursive)
- Spans for move validation (ancestry check)
- Correlate with product count updates