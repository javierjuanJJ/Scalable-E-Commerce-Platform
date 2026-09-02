# Feature Specification: User Registration

## Overview

**Feature ID**: 001-registration  
**Title**: User Registration  
**Status**: Draft  
**Priority**: P0 (Critical)

## Proposal Reference

See `spec/constitution/mission.md` - Core Principle: Security First, Spec-Driven Development

## Requirements

### ADDED Requirements

#### Requirement: User Registration Endpoint

**Description**: Allow new users to create an account with email and password.

**Scenarios**:

##### Scenario: Successful Registration
- **WHEN** a client sends POST `/api/v1/auth/register` with valid email, password, and optional name
- **THEN** the system creates a new user account
- **AND** returns HTTP 201 with user object (excluding password hash)
- **AND** sends verification email (production) or marks email as verified (development)
- **AND** logs registration event with userId, email, and timestamp

##### Scenario: Duplicate Email Rejection
- **WHEN** a client sends POST `/api/v1/auth/register` with an email that already exists
- **THEN** the system returns HTTP 409 Conflict
- **AND** response body contains error code `EMAIL_ALREADY_EXISTS`
- **AND** no user account is created
- **AND** logs failed attempt with email and reason

##### Scenario: Invalid Email Format
- **WHEN** a client sends POST `/api/v1/auth/register` with invalid email format
- **THEN** the system returns HTTP 400 Bad Request
- **AND** response body contains validation errors with field `email`
- **AND** logs validation failure

##### Scenario: Weak Password Rejection
- **WHEN** a client sends POST `/api/v1/auth/register` with password < 8 characters or > 128 characters
- **THEN** the system returns HTTP 400 Bad Request
- **AND** response body contains validation errors with field `password`
- **AND** logs validation failure

##### Scenario: Missing Required Fields
- **WHEN** a client sends POST `/api/v1/auth/register` without email or password
- **THEN** the system returns HTTP 400 Bad Request
- **AND** response body contains validation errors for missing fields

#### Requirement: Email Verification Flow (Better Auth)

**Description**: Integration with Better Auth for email verification.

**Scenarios**:

##### Scenario: Verification Email Sent
- **WHEN** registration succeeds in production environment
- **THEN** Better Auth sends verification email via configured provider
- **AND** user's `emailVerified` field remains `false`
- **AND** logs verification email sent event

##### Scenario: Verification Link Validation
- **WHEN** user clicks verification link with valid token
- **THEN** Better Auth marks `emailVerified: true`
- **AND** redirects to configured callback URL
- **AND** logs email verification success

##### Scenario: Expired/Invalid Token
- **WHEN** user clicks verification link with expired or invalid token
- **THEN** Better Auth returns error page
- **AND** logs verification failure with reason

#### Requirement: Password Security

**Description**: Secure password handling per OWASP guidelines.

**Scenarios**:

##### Scenario: Password Hashing
- **WHEN** user registers with password
- **THEN** password is hashed using Argon2id (via Better Auth)
- **AND** hash is stored, never plaintext
- **AND** work factor configured for ~100ms verification time

##### Scenario: Password Not Logged
- **WHEN** any log statement is emitted during registration
- **THEN** password field is never included in log output
- **AND** structured logs contain only safe fields (userId, email, timestamp)

### MODIFIED Requirements

None (new feature)

### REMOVED Requirements

None (new feature)

## Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-001 | POST `/api/v1/auth/register` creates user with valid input | Integration test |
| AC-002 | Duplicate email returns 409 with `EMAIL_ALREADY_EXISTS` | Integration test |
| AC-003 | Invalid email returns 400 with Zod validation errors | Integration test |
| AC-004 | Weak password returns 400 with validation errors | Integration test |
| AC-005 | Password hashed with Argon2id, never stored plaintext | Code review + test |
| AC-006 | Verification email sent in production | Manual + log verification |
| AC-007 | Structured logs emitted for all registration events | Log inspection |
| AC-008 | Response excludes passwordHash field | Integration test |

## Dependencies

- **Better Auth**: Core authentication library
- **Zod**: Input validation schemas
- **Pino**: Structured logging
- **JSON Storage (MVP)**: `models/user.js` with file-based persistence
- **Prisma Schema**: Prepared for PostgreSQL migration

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Registration completes < 500ms p95 |
| Security | Rate limit: 5 requests/minute per IP |
| Security | CORS configured for frontend origin only |
| Observability | All events logged with traceId for correlation |
| Compatibility | Works with JSON MVP and Prisma/PostgreSQL |

## Open Questions

1. Should registration auto-sign-in user (return session cookie)?
2. Custom email template for verification?
3. Username field in addition to email?
4. Invite-only registration for MVP?