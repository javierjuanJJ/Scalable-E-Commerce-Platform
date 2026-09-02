# Tasks: Profile Management

## Overview

**Feature**: 003-profile-management  
**Depends On**: 002-authentication (complete)

## Task Breakdown

### 1. Validation Schemas

- [ ] 1.1 Create user schemas (`backend/schemas/user.js`)
  - `profileUpdateSchema`: name (optional, max 100), avatarUrl (optional, url, max 500)
  - `adminUpdateSchema`: name, role (enum USER/ADMIN), emailVerified (boolean)
  - `paginationSchema`: page (int, min 1), limit (int, min 1, max 100), search (string), role (enum), sortBy (enum), sortOrder (asc/desc)
  - `deleteConfirmationSchema`: password (string, min 1)
  - **Verification**: TypeScript compiles, Zod validation works

### 2. User Model Extensions

- [ ] 2.1 Extend JSON user model (`backend/models/user.js`)
  - `update(id, data)`: partial update, returns updated user
  - `delete(id)`: soft delete (add deletedAt) or hard delete
  - `findAll({ page, limit, search, role, sortBy, sortOrder })`: paginated, filtered, sorted
  - `count({ search, role })`: total count for pagination
  - Atomic writes for all mutations
  - **Verification**: Unit tests for all new methods

- [ ] 2.2 Add soft delete support (if chosen)
  - Add `deletedAt` field to user records
  - Filter `deletedAt: null` in all find methods
  - **Verification**: Deleted users excluded from lists

### 3. Middleware

- [ ] 3.1 Create requireAdmin middleware (`backend/middlewares/requireAdmin.js`)
  - Checks `req.user.role === 'ADMIN'`
  - Returns 403 with `FORBIDDEN` code if not admin
  - **Verification**: Integration test non-admin → 403

### 4. User Controller

- [ ] 4.1 Create user controller (`backend/controllers/user.js`)
  - `getMe(req, res)`: returns `req.user` (already attached)
  - `updateMe(req, res)`: validates, calls model.update, logs changes
  - `deleteMe(req, res)`: validates password, verifies, deletes, revokes sessions
  - `listUsers(req, res)`: admin only, pagination, filters, sorting
  - `getUser(req, res)`: admin only, by ID
  - `updateUser(req, res)`: admin only, partial update, audit log
  - `deleteUser(req, res)`: admin only, delete, audit log
  - **Verification**: All handlers implemented, TypeScript compiles

### 5. User Routes

- [ ] 5.1 Create user routes (`backend/routes/user.js`)
  - `GET /me` → requireAuth → controller.getMe
  - `PATCH /me` → requireAuth → validate(profileUpdateSchema) → controller.updateMe
  - `DELETE /me` → requireAuth → validate(deleteConfirmationSchema) → controller.deleteMe
  - `GET /` → requireAuth → requireAdmin → validate(paginationSchema) → controller.listUsers
  - `GET /:id` → requireAuth → requireAdmin → controller.getUser
  - `PATCH /:id` → requireAuth → requireAdmin → validate(adminUpdateSchema) → controller.updateUser
  - `DELETE /:id` → requireAuth → requireAdmin → controller.deleteUser
  - Mount at `/api/v1/users` in app.js
  - **Verification**: Routes registered, middleware order correct

### 6. App Integration

- [ ] 6.1 Register user routes in app (`backend/app.js`)
  - Import and mount user router
  - **Verification**: Routes accessible

### 7. Integration Tests

- [ ] 7.1 Write self profile tests (`backend/app.test.js` or `backend/test/user.test.js`)
  - Test: GET /me → 200, correct fields, no passwordHash
  - Test: GET /me unauthorized → 401
  - Test: PATCH /me valid → 200, updated, logged
  - Test: PATCH /me partial → 200, only provided fields changed
  - Test: PATCH /me reject email → 400
  - Test: PATCH /me reject role → 400
  - Test: PATCH /me reject passwordHash → 400
  - Test: DELETE /me valid password → 200, deleted
  - Test: DELETE /me wrong password → 401
  - Test: DELETE /me no password → 400
  - **Verification**: All self profile tests pass

- [ ] 7.2 Write admin tests
  - Test: GET /users (admin) → 200, paginated
  - Test: GET /users (non-admin) → 403
  - Test: GET /users with search, filter, sort → 200, correct results
  - Test: GET /users pagination → correct page, limit, total
  - Test: GET /users/:id (admin) → 200
  - Test: GET /users/:id not found → 404
  - Test: PATCH /users/:id (admin) → 200, audit logged
  - Test: DELETE /users/:id (admin) → 200, audit logged
  - Test: Admin actions logged with adminId, targetUserId, changes
  - **Verification**: All admin tests pass

### 8. Documentation

- [ ] 8.1 Update API documentation
  - Document all user endpoints
  - **Verification**: Docs generate

- [ ] 8.2 Update AGENTS.md if needed
  - **Verification**: AGENTS.md current

## Progress Tracking

| Task Group | Status | Completed | Total |
|------------|--------|-----------|-------|
| Validation Schemas | Pending | 0 | 1 |
| User Model Extensions | Pending | 0 | 2 |
| Middleware | Pending | 0 | 1 |
| User Controller | Pending | 0 | 1 |
| User Routes | Pending | 0 | 1 |
| App Integration | Pending | 0 | 1 |
| Integration Tests | Pending | 0 | 2 |
| Documentation | Pending | 0 | 2 |
| **Total** | | **0** | **11** |

## Notes

- Dependency: 002-authentication provides requireAuth, session handling, Better Auth instance
- Admin role check uses `req.user.role` from Better Auth session
- Soft delete recommended for audit trail; hard delete simpler for MVP
- Password verification for deletion: use Better Auth's verify or direct Argon2id
- All admin actions must be audit logged for compliance
- Pagination: use standard `page`/`limit` with `total`/`totalPages` in response