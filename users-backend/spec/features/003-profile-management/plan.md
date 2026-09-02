# Implementation Plan: Profile Management

## Overview

**Feature**: 003-profile-management  
**Depends On**: 002-authentication (complete)

## Architecture Decisions

### 1. Route Organization
```
/api/v1/users/me          → User profile (self)
/api/v1/users             → Admin list (paginated)
/api/v1/users/:id         → Admin get/update/delete
```

### 2. Role-Based Access Control
- Better Auth provides `user.role` (USER/ADMIN)
- `requireAdmin` middleware checks `req.user.role === 'ADMIN'`
- Self endpoints use `requireAuth` only

### 3. Validation Strategy
- Separate Zod schemas for self-update vs admin-update
- Self: `name?`, `avatarUrl?`
- Admin: `name?`, `role?`, `emailVerified?`
- Both reject: `id`, `email`, `passwordHash`, `createdAt`, `updatedAt`

### 4. User Model Extensions
Extend `models/user.js` with:
- `update(id, data)` - partial update
- `delete(id)` - soft/hard delete
- `findAll({ page, limit, search, role, sortBy, sortOrder })` - paginated list
- `count({ search, role })` - total for pagination

### 5. Password Verification for Deletion
- Use Better Auth's `verifyPassword` or direct Argon2id verify
- Compare provided password with stored hash
- Constant-time comparison

### 6. Admin Audit Logging
- Structured logs for all admin actions
- Fields: `adminId`, `targetUserId`, `action`, `changes`, `timestamp`

## Data Flow

### Self Profile Update
```
PATCH /users/me
  → requireAuth
  → validate(profileUpdateSchema)
  → controller.updateProfile
  → model.update(userId, validatedData)
  → Log profile_updated
  → Return updated user
```

### Admin List Users
```
GET /users?page=1&limit=20&search=john&role=USER
  → requireAuth → requireAdmin
  → validate(paginationSchema)
  → controller.listUsers
  → model.findAll(filters)
  → Return paginated response
```

## Better Auth Integration

```typescript
// lib/auth.js - role detection
// User model has role field (USER/ADMIN)
// Middleware checks req.user.role
```

## Error Handling

| Scenario | HTTP Status | Code |
|----------|-------------|------|
| Unauthorized (no session) | 401 | UNAUTHENTICATED |
| Forbidden (non-admin on admin route) | 403 | FORBIDDEN |
| Validation error | 400 | VALIDATION_ERROR |
| User not found | 404 | USER_NOT_FOUND |
| Invalid password (delete) | 401 | INVALID_PASSWORD |
| Disallowed field in update | 400 | VALIDATION_ERROR |

## Testing Strategy

### Integration Tests
1. **Get Self Profile**: Authenticated → 200, correct fields, no passwordHash
2. **Get Self Profile Unauthorized**: No session → 401
3. **Update Self Profile**: Valid name → 200, updated, logged
4. **Update Self Partial**: Only avatarUrl → 200, only avatarUrl changed
5. **Update Self Reject Email**: Include email → 400, validation error
6. **Update Self Reject Role**: Include role → 400, validation error
6. **Delete Self**: Valid password → 200, user deleted, sessions revoked
7. **Delete Self Wrong Password**: Wrong password → 401, INVALID_PASSWORD
8. **Delete Self No Password**: Missing password → 400
9. **Admin List Users**: Admin → 200, paginated, filtered
10. **Admin List Users Non-Admin**: User → 403, FORBIDDEN
11. **Admin Get User**: Admin → 200, user data
12. **Admin Update User**: Admin updates role → 200, logged
13. **Admin Delete User**: Admin → 200, user deleted
14. **Pagination**: page, limit, total, totalPages correct
15. **Search/Filter/Sort**: Combined queries work

## File Structure Impact

```
backend/
├── schemas/
│   └── user.js              # profileUpdateSchema, adminUpdateSchema, paginationSchema
├── models/
│   └── user.js              # Extended with update, delete, findAll, count
├── middlewares/
│   └── requireAdmin.js      # Role check middleware
├── controllers/
│   └── user.js              # Profile controllers (self + admin)
├── routes/
│   └── user.js              # User routes
└── test/
    └── user.test.js         # Profile tests
```

## Configuration

```env
# Pagination defaults
DEFAULT_PAGE=1
DEFAULT_LIMIT=20
MAX_LIMIT=100

# Account deletion
DELETE_CONFIRMATION_REQUIRED=true
SOFT_DELETE=true  # or false for hard delete
```

## Migration Considerations

- Prisma model already has all required fields
- `findAll` translates to Prisma `findMany` with `skip`/`take`/`where`/`orderBy`
- Soft delete: add `deletedAt` field to Prisma schema, filter in queries
- Admin role stored in User model (already in Prisma schema)

## Rollback Plan

If pagination performance issues with JSON:
1. Add in-memory index for search
2. Move to Prisma/PostgreSQL earlier
3. Estimated effort: 1 day