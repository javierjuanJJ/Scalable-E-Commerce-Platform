# Spec: Product Listings

## Feature Overview
**Feature ID**: 001
**Name**: Product Listings
**Description**: Core product catalog functionality - CRUD operations for products with search, filtering, and pagination

## User Stories

### US-001: List Products
**As a** customer  
**I want to** browse products with pagination  
**So that** I can discover items to purchase

**Acceptance Criteria**:
- GET `/api/v1/products` returns paginated list
- Default page=1, limit=20, max limit=100
- Response includes `data`, `pagination` (page, limit, total, totalPages)
- Supports sorting by: `name`, `price`, `createdAt` (asc/desc)

### US-002: Search Products
**As a** customer  
**I want to** search products by name/description  
**So that** I can find specific items

**Acceptance Criteria**:
- Query param `q` for full-text search on name and description
- Minimum 2 characters for search
- Returns matching products with relevance scoring
- Combined with pagination and filters

### US-003: Filter Products
**As a** customer  
**I want to** filter products by category, price range, availability  
**So that** I can narrow down results

**Acceptance Criteria**:
- `categoryId` - filter by category (single or multiple)
- `minPrice` / `maxPrice` - price range filter
- `inStock` - boolean filter for available products
- Filters combinable with search and pagination

### US-004: Get Product Details
**As a** customer  
**I want to** view detailed product information  
**So that** I can make purchase decisions

**Acceptance Criteria**:
- GET `/api/v1/products/:id` returns full product details
- Includes: id, name, description, price, images, category, inventory status, timestamps
- 404 if product not found or soft-deleted
- Includes related products (same category, max 4)

### US-005: Create Product (Admin)
**As an** admin  
**I want to** create new products  
**So that** they appear in the catalog

**Acceptance Criteria**:
- POST `/api/v1/products` with validated body
- Required: name, description, price, categoryId
- Optional: images[], sku, weight, dimensions, tags[]
- Returns 201 with created product
- Validates category exists
- Generates slug from name (unique)

### US-006: Update Product (Admin)
**As an** admin  
**I want to** update product information  
**So that** catalog stays current

**Acceptance Criteria**:
- PATCH `/api/v1/products/:id` with partial update
- Validates optimistic lock via `version` field
- Returns 409 if version mismatch
- Cannot update: id, createdAt, slug
- Returns updated product with new version

### US-007: Delete Product (Admin)
**As an** admin  
**I want to** soft-delete products  
**So that** they're hidden but history preserved

**Acceptance Criteria**:
- DELETE `/api/v1/products/:id` soft deletes
- Sets `deletedAt` timestamp
- Excluded from all listings by default
- `?includeDeleted=true` admin param to see deleted
- Returns 204 on success

## Data Model

### Product Entity
```typescript
interface Product {
  id: string;                    // UUID
  slug: string;                  // URL-friendly, unique
  name: string;                  // 1-200 chars
  description: string;           // 1-5000 chars
  price: number;                 // Decimal, > 0, 2 decimal places
  compareAtPrice?: number;       // Original price for discounts
  sku: string;                   // Unique stock keeping unit
  barcode?: string;              // EAN/UPC
  images: ProductImage[];        // Array of image objects
  categoryId: string;            // FK to Category
  category?: Category;           // Populated on include
  inventory?: Inventory;         // Stock information
  weight?: number;               // In grams
  dimensions?: Dimensions;       // L x W x H in cm
  tags: string[];                // Searchable tags
  status: ProductStatus;         // DRAFT | ACTIVE | ARCHIVED
  featured: boolean;             // Homepage feature flag
  seoTitle?: string;             // SEO meta title
  seoDescription?: string;       // SEO meta description
  version: number;               // Optimistic lock
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;              // Soft delete
  createdBy: string;             // User ID
  updatedBy: string;             // User ID
}

interface ProductImage {
  id: string;
  url: string;
  alt: string;
  position: number;              // Display order
  isPrimary: boolean;
}

interface Dimensions {
  length: number;
  width: number;
  height: number;
}

enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED'
}
```

## API Specification

### GET /api/v1/products
**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 20 | Items per page (max 100) |
| sort | string | createdAt:desc | Field:direction (name, price, createdAt) |
| q | string | - | Search query (min 2 chars) |
| categoryId | string | - | Filter by category UUID |
| categoryIds | string[] | - | Multiple categories (comma-separated) |
| minPrice | number | - | Minimum price |
| maxPrice | number | - | Maximum price |
| inStock | boolean | - | Only in-stock products |
| status | string | ACTIVE | Product status filter (admin) |
| includeDeleted | boolean | false | Include soft-deleted (admin) |

**Response 200**:
```json
{
  "data": [Product],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### GET /api/v1/products/:id
**Response 200**: Product (with category, inventory, relatedProducts)
**Response 404**: `{ error: { code: "NOT_FOUND", message: "Product not found" } }`

### POST /api/v1/products
**Request Body** (validated by Zod):
```json
{
  "name": "string (1-200)",
  "description": "string (1-5000)",
  "price": "number (>0, 2 decimals)",
  "compareAtPrice": "number (>0, 2 decimals)",
  "sku": "string (unique, alphanumeric)",
  "barcode": "string (EAN/UPC)",
  "categoryId": "uuid",
  "images": "[{ url: string, alt: string, position: number, isPrimary: boolean }]",
  "weight": "number (grams)",
  "dimensions": "{ length, width, height }",
  "tags": "string[]",
  "status": "DRAFT|ACTIVE|ARCHIVED",
  "featured": "boolean",
  "seoTitle": "string (max 60)",
  "seoDescription": "string (max 160)"
}
```
**Response 201**: Product
**Response 422**: Validation errors

### PATCH /api/v1/products/:id
**Headers**: `If-Match: <version>` (optimistic lock)
**Request Body**: Partial Product (validated)
**Response 200**: Updated Product
**Response 409**: `{ error: { code: "VERSION_CONFLICT", message: "Product was modified by another user" } }`
**Response 404**: Not found

### DELETE /api/v1/products/:id
**Response 204**: No content
**Response 404**: Not found

## Business Rules

1. **Slug Generation**: Auto-generated from name, made unique with suffix if needed
2. **SKU Uniqueness**: Must be unique across all products
3. **Price Precision**: Stored as integer cents, returned as decimal
4. **Primary Image**: Exactly one image must have `isPrimary: true`
5. **Status Transitions**: DRAFT → ACTIVE → ARCHIVED (no reverse)
6. **Category Validation**: Category must exist and be active
7. **Inventory Link**: Product creation triggers inventory record creation

## Events Published

| Event | Payload | Description |
|-------|---------|-------------|
| `product.created` | Product | New product published |
| `product.updated` | Product | Product details changed |
| `product.deleted` | { id, deletedAt } | Product soft-deleted |
| `product.stock.changed` | { productId, quantity, operation } | Inventory updated |

## Non-Functional Requirements

- **Response Time**: P95 < 200ms for listings, < 100ms for single product
- **Throughput**: 1000 RPS for read operations
- **Availability**: 99.9% uptime
- **Cache**: Product listings cached 60s, details cached 300s
- **Search**: Full-text search indexed on name, description, tags

## Dependencies
- **002-categories**: Category must exist for product creation
- **003-inventory**: Inventory record created with product
- **004-centralized-logging**: All operations logged to ELK
- **005-docker-compose**: Service runs in container

## Out of Scope
- Product variants/options (separate feature)
- Reviews and ratings
- Advanced merchandising (bundles, cross-sells)
- Import/export bulk operations