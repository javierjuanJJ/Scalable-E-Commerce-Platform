# Feature Specification: Profile Management

## Overview

**Feature ID**: 003-profile-management  
**Title**: User Profile Management  
**Status**: Draft  
**Priority**: P0 (Critical)

## Proposal Reference

See `spec/constitution/mission.md` - Core Principles: Security First, Database Agnostic

## Requirements

### ADDED Requirements

#### Requirement: Get User Profile

**Description**: Retrieve authenticated user's profile data.

**Scenarios**:

##### Scenario: Successful Profile Retrieval
- **WHEN** an authenticated client sends GET `/api/v1/users/me`
- **THEN** the system returns HTTP 200 with user profile
- **AND** response includes: id, email, name, avatarUrl, emailVerified, role, createdAt, updatedAt
- **AND** excludes: passwordHash, sessions, accounts
- **AND** logs profile access with userId

##### Scenario: Unauthorized Access
- **WHEN** an unauthenticated client sends GET `/api/v1/users/me`
- **THEN** the system returns HTTP 401 Unauthorized
- **AND** response body contains error code `UNAUTHENTICATED`

#### Requirement: Update User Profile

**Description**: Allow users to update their profile information.

**Scenarios**:

##### Scenario: Successful Profile Update
- **WHEN** an authenticated client sends PATCH `/api/v1/users/me` with valid fields (name, avatarUrl)
- **THEN** the system updates the user record
- **AND** returns HTTP 200 with updated user profile
- **AND** logs profile update with userId and changed fields
- **AND** emits `user.profile_updated` event

##### Scenario: Partial Update
- **WHEN** an authenticated client sends PATCH `/api/v1/users/me` with only `name` field
- **THEN** the system updates only the name field
- **AND** other fields remain unchanged
- **AND** returns updated profile

##### Scenario: Invalid Field Rejection
- **WHEN** an authenticated client sends PATCH `/api/v1/users/me` with disallowed fields (email, passwordHash, role, id)
- **THEN** the system returns HTTP 400 Bad Request
- **AND** response body contains validation errors for disallowed fields
- **AND** no fields are updated

##### Scenario: Email Change (Separate Flow)
- **WHEN** user wants to change email
- **THEN** system requires separate verified flow (not in this feature)
- **AND** returns 400 if email included in profile update

#### Requirement: Delete User Account

**Description**: Allow users to permanently delete their account.

**Scenarios**:

##### Scenario: Successful Account Deletion
- **WHEN** an authenticated client sends DELETE `/api/v1/users/me` with password confirmation
- **THEN** the system verifies password
- **AND** revokes all sessions
- **AND** deletes user record (soft delete or hard delete)
- **AND** returns HTTP 200 with success message
- **AND** logs account deletion with userId

##### Scenario: Incorrect Password
- **WHEN** an authenticated client sends DELETE `/api/v1/users/me` with wrong password
- **THEN** the system returns HTTP 401 Unauthorized
- **AND** response body contains error code `INVALID_PASSWORD`
- **AND** account not deleted

##### Scenario: Missing Password Confirmation
- **WHEN** an authenticated client sends DELETE `/api/v1/users/me` without password
- **THEN** the system returns HTTP 400 Bad Request
- **AND** response body contains validation error for password field

#### Requirement: Admin User Management

**Description**: Admin endpoints for user management.

**Scenarios**:

##### Scenario: Admin List Users
- **WHEN** an admin user sends GET `/api/v1/users` with pagination
- **THEN** the system returns HTTP 200 with paginated user list
- **AND** supports query params: page, limit, search, role, sortBy, sortOrder
- **AND** excludes passwordHash from all records

##### Scenario: Admin Get User By ID
- **WHEN** an admin user sends GET `/api/v1/users/:id`
- **THEN** the system returns HTTP 200 with user profile
- **AND** returns 404 if user not found

##### Scenario: Admin Update User
- **WHEN** an admin user sends PATCH `/api/v1/users/:id` with allowed fields (name, role, emailVerified)
- **THEN** the system updates the user
- **AND** returns HTTP 200 with updated user
- **AND** logs admin action with adminId, targetUserId, changes

##### Scenario: Admin Delete User
- **WHEN** an admin user sends DELETE `/api/v1/users/:id`
- **THEN** the system deletes the user
- **AND** returns HTTP 200
- **AND** logs admin action

##### Scenario: Non-Admin Access Denied
- **WHEN** a non-admin user accesses admin endpoints
- **THEN** the system returns HTTP 403 Forbidden
- **AND** response body contains error code `FORBIDDEN`

### MODIFIED Requirements

None

### REMOVED Requirements

None

## Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-001 | GET `/api/v1/users/me` returns profile without sensitive fields | Integration test |
| AC-002 | PATCH `/api/v1/users/me` updates allowed fields only | Integration test |
| AC-003 | PATCH rejects email, passwordHash, role, id fields | Integration test |
| AC-004 | DELETE `/api/v1/users/me` requires password confirmation | Integration test |
| AC-005 | Admin endpoints require admin role | Integration test |
| AC-006 | Admin list supports pagination, search, filter, sort | Integration test |
| AC-007 | All profile events logged with userId, changes | Log inspection |
| AC-008 | Works with JSON MVP and Prisma/PostgreSQL | Integration test both |

## Dependencies

- **Feature 002-authentication**: requireAuth middleware, session handling
- **Better Auth**: Admin role detection
- **Zod**: Validation schemas for profile updates
- **JSON/Prisma Model**: User CRUD operations

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Profile operations < 200ms p95 |
| Security | Users cannot escalate privileges via profile update |
| Security | Admin actions audit logged |
| Privacy | Email change requires verification flow (future) |
| Compatibility | Same API for JSON and Prisma backends |

## Open Questions

1. Soft delete vs hard delete for account deletion?
2. Avatar upload handling (separate service or base64)?
3. Profile visibility settings (public/private)?
4. GDPR right to data export endpoint?