# Feature Specification: Authentication

## Overview

**Feature ID**: 002-authentication  
**Title**: Authentication (Login, Session, JWT)  
**Status**: Draft  
**Priority**: P0 (Critical)

## Proposal Reference

See `spec/constitution/mission.md` - Security First principle

## Requirements

### ADDED Requirements

#### Requirement: User Login Endpoint

**Description**: Allow registered users to authenticate and receive session.

**Scenarios**:

##### Scenario: Successful Login
- **WHEN** a client sends POST `/api/v1/auth/login` with valid email and password
- **THEN** the system validates credentials via Better Auth
- **AND** creates a session with secure HTTP-only cookie
- **AND** returns HTTP 200 with user object (no passwordHash) and session info
- **AND** logs successful login with userId, email, IP, userAgent

##### Scenario: Invalid Credentials
- **WHEN** a client sends POST `/api/v1/auth/login` with wrong password
- **THEN** the system returns HTTP 401 Unauthorized
- **AND** response body contains error code `INVALID_CREDENTIALS`
- **AND** no session is created
- **AND** logs failed attempt with email, reason, IP

##### Scenario: Unverified Email (Production)
- **WHEN** a client sends POST `/api/v1/auth/login` with valid credentials but unverified email
- **THEN** the system returns HTTP 403 Forbidden
- **AND** response body contains error code `EMAIL_NOT_VERIFIED`
- **AND** logs blocked login attempt

##### Scenario: Remember Me Option
- **WHEN** a client sends POST `/api/v1/auth/login` with `rememberMe: true`
- **THEN** session cookie expires in 30 days (vs 24 hours default)
- **AND** logs rememberMe preference

#### Requirement: Session Management

**Description**: Secure session handling with Better Auth.

**Scenarios**:

##### Scenario: Session Cookie Security
- **WHEN** session cookie is set
- **THEN** cookie has: `HttpOnly`, `Secure` (production), `SameSite: 'lax'`, `Path: '/'`
- **AND** cookie name prefixed: `__session`

##### Scenario: Session Validation Middleware
- **WHEN** a request includes valid session cookie
- **THEN** middleware attaches `req.user` and `req.session` to request
- **AND** protected routes can access user data

##### Scenario: Session Expiry
- **WHEN** session expires or is revoked
- **THEN** subsequent requests return 401 Unauthorized
- **AND** client must re-authenticate

#### Requirement: Logout Endpoint

**Description**: Allow users to terminate their session.

**Scenarios**:

##### Scenario: Successful Logout
- **WHEN** a client sends POST `/api/v1/auth/logout` with valid session
- **THEN** the system revokes session via Better Auth
- **AND** clears session cookie
- **AND** returns HTTP 200 with success message
- **AND** logs logout event with userId

##### Scenario: Logout Without Session
- **WHEN** a client sends POST `/api/v1/auth/logout` without session
- **THEN** the system returns HTTP 200 (idempotent)
- **AND** clears any existing cookie

#### Requirement: Get Current User

**Description**: Retrieve authenticated user profile.

**Scenarios**:

##### Scenario: Authenticated Request
- **WHEN** a client sends GET `/api/v1/auth/me` with valid session
- **THEN** the system returns HTTP 200 with current user object
- **AND** excludes passwordHash and sensitive fields

##### Scenario: Unauthenticated Request
- **WHEN** a client sends GET `/api/v1/auth/me` without session
- **THEN** the system returns HTTP 401 Unauthorized
- **AND** response body contains error code `UNAUTHENTICATED`

#### Requirement: Password Reset Flow

**Description**: Secure password reset via email.

**Scenarios**:

##### Scenario: Request Password Reset
- **WHEN** a client sends POST `/api/v1/auth/forgot-password` with registered email
- **THEN** the system generates reset token via Better Auth
- **AND** sends reset email (production) or logs token (development)
- **AND** returns HTTP 200 (always, to prevent email enumeration)
- **AND** logs reset request with email

##### Scenario: Reset Password
- **WHEN** a client sends POST `/api/v1/auth/reset-password` with valid token and new password
- **THEN** the system validates token and updates password hash
- **AND** revokes all existing sessions for user
- **AND** returns HTTP 200 with success message
- **AND** logs password reset with userId

##### Scenario: Invalid/Expired Reset Token
- **WHEN** a client sends POST `/api/v1/auth/reset-password` with invalid token
- **THEN** the system returns HTTP 400 Bad Request
- **AND** response body contains error code `INVALID_RESET_TOKEN`

### MODIFIED Requirements

None

### REMOVED Requirements

None

## Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-001 | POST `/api/v1/auth/login` returns session cookie on success | Integration test |
| AC-002 | Invalid credentials return 401 with `INVALID_CREDENTIALS` | Integration test |
| AC-003 | Unverified email blocked in production (403) | Integration test |
| AC-004 | Session cookie has HttpOnly, Secure, SameSite=lax | Code review + test |
| AC-005 | GET `/api/v1/auth/me` returns user with valid session | Integration test |
| AC-006 | POST `/api/v1/auth/logout` revokes session and clears cookie | Integration test |
| AC-007 | Password reset flow works end-to-end | Integration test |
| AC-008 | All auth events logged with traceId, userId, IP | Log inspection |

## Dependencies

- **Feature 001-registration**: User must exist
- **Better Auth**: Session management, password verification
- **Zod**: Input validation
- **Pino**: Structured logging

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Login completes < 300ms p95 |
| Security | Rate limit: 10 requests/minute per IP for login |
| Security | Brute force protection: lock after 5 failures (15 min) |
| Security | Password reset tokens expire in 1 hour |
| Observability | All auth events correlated with traceId |

## Open Questions

1. JWT access tokens in addition to session cookies?
2. Refresh token rotation strategy?
3. Device/session management UI (list/revoke sessions)?
4. Magic link authentication as alternative?