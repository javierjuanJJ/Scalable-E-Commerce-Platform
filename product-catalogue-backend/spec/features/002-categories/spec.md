# Spec: Categories

## Feature Overview
**Feature ID**: 002
**Name**: Categories
**Description**: Hierarchical category management for organizing products with tree structure, SEO, and navigation

## User Stories

### US-001: List Categories (Tree)
**As a** customer  
**I want to** browse category hierarchy  
**So that** I can navigate to product sections

**Acceptance Criteria**:
- GET `/api/v1/categories` returns tree structure
- Root categories with nested children
- Each node: id, name, slug, description, image, productCount, children[]
- `?flat=true` returns flat list for admin
- `?includeProductCount=true` adds count (cached)

### US-002: Get Category Details
**As a** customer  
**I want to** view category with products  
**So that** I can browse products in that category

**Acceptance Criteria**:
- GET `/api/v1/categories/:id` returns category + paginated products
- Products use same filtering/pagination as product listings
- Breadcrumb trail: root → ... → current
- 404 if not found or soft-deleted

### US-003: Get Category by Slug
**As a** customer  
**I want to** access category via SEO-friendly URL  
**So that** URLs are readable and shareable

**Acceptance Criteria**:
- GET `/api/v1/categories/slug/:slug` returns category
- Slug unique across all levels
- Same response as GET by ID

### US-004: Create Category (Admin)
**As an** admin  
**I want to** create categories  
**So that** products can be organized

**Acceptance Criteria**:
- POST `/api/v1/categories` with validated body
- Required: name, parentId (nullable for root)
- Optional: description, image, seoTitle, seoDescription, sortOrder
- Auto-generate slug from name (unique within parent)
- Returns 201 with created category
- Validates parent exists and not deleted

### US-005: Update Category (Admin)
**As an** admin  
**I want to** update category info  
**So that** navigation stays current

**Acceptance Criteria**:
- PATCH `/api/v1/categories/:id` with partial update
- Optimistic locking via version
- Cannot move to own descendant (circular ref prevention)
- Slug regenerated if name changed (with uniqueness)
- Returns updated category

### US-006: Delete Category (Admin)
**As an** admin  
**I want to** remove categories  
**So that** obsolete sections are hidden

**Acceptance Criteria**:
- DELETE `/api/v1/categories/:id` soft deletes
- Fails if category has products (409 CONFLICT)
- Fails if category has children (409 CONFLICT)
- `?force=true` moves products to parent, children to parent
- Returns 204 on success

### US-007: Reorder Categories (Admin)
**As an** admin  
**I want to** change display order  
**So that** navigation reflects priority

**Acceptance Criteria**:
- PATCH `/api/v1/categories/reorder` with array of {id, sortOrder}
- Validates all IDs exist and same parent
- Atomic update
- Returns updated siblings

## Data Model

### Category Entity
```typescript
interface Category {
  id: string;                    // UUID
  slug: string;                  // Unique within parent
  name: string;                  // 1-100 chars
  description?: string;          // 1-2000 chars
  image?: string;                // Category banner/image URL
  parentId: string | null;       // FK to parent (null = root)
  parent?: Category;             // Populated on include
  children: Category[];          // Direct children
  path: string;                  // Materialized path: /root/parent/this/
  level: number;                 // Depth (0 = root)
  sortOrder: number;             // Display order among siblings
  productCount: number;          // Cached count (including descendants)
  directProductCount: number;    // Direct products only
  status: CategoryStatus;        // ACTIVE | INACTIVE | ARCHIVED
  seoTitle?: string;             // Max 60 chars
  seoDescription?: string;       // Max 160 chars
  version: number;               // Optimistic lock
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  createdBy: string;
  updatedBy: string;
}

enum CategoryStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED'
}
```

## API Specification

### GET /api/v1/categories
**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| flat | boolean | false | Flat list vs tree |
| includeProductCount | boolean | true | Include product counts |
| status | string | ACTIVE | Filter by status (admin) |
| parentId | string | - | Filter by parent (flat mode) |
| level | integer | - | Filter by depth level |
| includeDeleted | boolean | false | Include soft-deleted (admin) |

**Response 200** (tree):
```json
{
  "data": [
    {
      "id": "...",
      "name": "Electronics",
      "slug": "electronics",
      "children": [...]
    }
  ]
}
```

### GET /api/v1/categories/:id
**Response 200**: Category with products (paginated), breadcrumbs
**Response 404**: Not found

### GET /api/v1/categories/slug/:slug
**Response 200**: Category (same as by ID)

### POST /api/v1/categories
**Request Body**:
```json
{
  "name": "string (1-100)",
  "parentId": "uuid|null",
  "description": "string (1-2000)",
  "image": "string (URL)",
  "sortOrder": "integer (default: 0)",
  "seoTitle": "string (max 60)",
  "seoDescription": "string (max 160)",
  "status": "ACTIVE|INACTIVE|ARCHIVED"
}
```
**Response 201**: Category

### PATCH /api/v1/categories/:id
**Headers**: `If-Match: <version>`
**Request Body**: Partial Category
**Response 200**: Updated Category
**Response 409**: Version conflict or circular reference

### DELETE /api/v1/categories/:id
**Query**: `?force=true` (optional)
**Response 204**: Success
**Response 409**: Has products/children (unless force)
**Response 404**: Not found

### PATCH /api/v1/categories/reorder
**Request Body**:
```json
{
  "items": [
    { "id": "uuid", "sortOrder": 1 },
    { "id": "uuid", "sortOrder": 2 }
  ]
}
```
**Response 200**: Updated categories array

## Business Rules

1. **Slug Uniqueness**: Unique within same parent (siblings)
2. **Max Depth**: 5 levels (root = 0)
3. **Root Categories**: parentId = null, level = 0
4. **Materialized Path**: `/root-id/parent-id/this-id/` for fast ancestry queries
5. **Product Count**: Cached, updated via events from product service
6. **Circular Prevention**: Cannot set parent to self or descendant
7. **Status Inheritance**: Inactive parent → children hidden from public API
8. **Default Sort**: sortOrder ASC, then name ASC

## Events Published

| Event | Payload | Description |
|-------|---------|-------------|
| `category.created` | Category | New category |
| `category.updated` | Category | Details changed |
| `category.deleted` | { id, deletedAt } | Soft deleted |
| `category.reordered` | { parentId, items[] } | Sort order changed |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| `product.created` | Product Listings | Increment productCount |
| `product.deleted` | Product Listings | Decrement productCount |
| `product.updated` | Product Listings | Update count if category changed |

## Non-Functional Requirements

- **Tree Load**: P95 < 100ms for full tree (cached)
- **Product Count**: Eventually consistent (async events)
- **Cache**: Tree cached 300s, invalidated on changes
- **Max Categories**: 10,000 total, 100 per level

## Dependencies
- **001-product-listings**: Consumes product events for counts
- **004-centralized-logging**: All operations logged
- **005-docker-compose**: Service containerized

## Out of Scope
- Category attributes/filters (color, size, etc.)
- Category-specific product sorting
- Multi-language category names
- Category permissions/ACL