# Tasks: Centralized Logging (ELK Stack)

## Overview

**Feature**: 004-centralized-logging  
**Depends On**: 001-registration, 002-authentication, 003-profile-management (for log integration points)

## Task Breakdown

### 1. Core Logger Configuration

- [ ] 1.1 Create Pino logger (`backend/lib/logger.js`)
  - Pretty print in development (`LOG_PRETTY=true`)
  - JSON output in production
  - Child logger factory for components
  - Default fields: `service: 'user-service'`, `hostname`, `pid`
  - **Verification**: `logger.info('test')` outputs correct format

- [ ] 1.2 Add Elasticsearch transport (`backend/lib/logger.js`)
  - Conditional: only if `ELASTICSEARCH_NODE` env var set
  - Use `pino-elasticsearch` with batch config
  - Index pattern: `user-service-logs-${NODE_ENV}-%{DATE}`
  - Handle transport errors gracefully (log to stderr, continue)
  - **Verification**: Logs appear in ES when configured

- [ ] 1.3 Create security logger (`backend/lib/security-logger.js`)
  - Child logger: `logger.child({ component: 'security' })`
  - Helper methods: `logLogin()`, `logLogout()`, `logFailedAttempt()`, `logRegister()`, `logPasswordReset()`
  - Auto-hash email for privacy: `hashEmail(email)`
  - **Verification**: Security events have correct structure

### 2. Request Logging Middleware

- [ ] 2.1 Create traceId middleware (`backend/middlewares/trace-id.js`)
  - Extract `traceId` from `traceparent` header (W3C format)
  - Generate new UUID v4 if not present
  - Attach to `req.traceId` and response header `traceparent`
  - **Verification**: TraceId propagated through request/response

- [ ] 2.2 Create request/response logger (`backend/middlewares/request-logger.js`)
  - Log request start (debug): method, url, traceId, ip, userAgent
  - Log response finish (info/warn/error): statusCode, responseTime, userId (if auth)
  - Level: info for 2xx/3xx, warn for 4xx, error for 5xx
  - Include traceId in all logs
  - **Verification**: Integration test shows structured request logs

### 3. Health Check Endpoint

- [ ] 3.1 Create health routes (`backend/routes/health.js`)
  - `GET /health` → controller.health
  - `GET /health/live` → liveness (always 200)
  - `GET /health/ready` → readiness (checks dependencies)
  - **Verification**: Endpoints respond correctly

- [ ] 3.2 Create health controller (`backend/controllers/health.js`)
  - `health(req, res)`: returns `{ status: 'ok', timestamp, uptime, version }`
  - `ready(req, res)`: checks database (JSON read / Prisma), Elasticsearch (cluster health)
  - Returns 503 if any critical check fails
  - **Verification**: Ready endpoint reflects dependency status

### 4. Better Auth Logging Integration

- [ ] 4.1 Extend Better Auth config with hooks (`backend/lib/auth.js`)
  - `afterSignUp`: log registration with userId, email
  - `afterSignIn`: log login with userId, email, ip
  - `afterSignOut`: log logout with userId
  - `afterPasswordReset`: log reset with userId
  - Use security logger for all
  - **Verification**: Auth events appear in logs with correct structure

### 5. Logstash Pipeline (Development)

- [ ] 5.1 Create Logstash config (`logstash/pipeline/logstash.conf`)
  - Input: beats (port 5044) or HTTP
  - Filters:
    - GeoIP from `ip` field
    - UserAgent parse (browser, os, device)
    - Sensitive field redaction: password, token, authorization, cookie
    - Add Kubernetes metadata if env vars present
  - Output: Elasticsearch with index pattern
  - **Verification**: Logstash starts, processes test logs

### 6. Kibana Dashboards

- [ ] 6.1 Create dashboard JSON exports (`kibana/dashboards/`)
  - Auth Events Dashboard: login/registration rates, failures, brute force
  - Error Analysis Dashboard: error rates, types, stack traces, top errors
  - Performance Dashboard: p50/p95/p99 latency, throughput, slow endpoints
  - Export as NDJSON for import via Kibana API
  - **Verification**: Dashboards import and render in Kibana

### 7. Elasticsearch Index Management

- [ ] 7.1 Create index template script (`scripts/es-index-template.js`)
  - Applies index template for `user-service-logs-*`
  - Defines mappings for structured fields
  - Sets up ILM policy (rollover 50GB/7d, delete 30d)
  - **Verification**: Template applied, ILM policy active

### 8. Integration with Existing Features

- [ ] 8.1 Update registration controller to use traceId
  - Pass traceId to logger calls
  - **Verification**: Registration logs have traceId

- [ ] 8.2 Update auth controller to use traceId
  - Pass traceId to logger calls
  - **Verification**: Auth logs have traceId

- [ ] 8.3 Update profile controller to use traceId
  - Pass traceId to logger calls
  - **Verification**: Profile logs have traceId

### 9. Tests

- [ ] 9.1 Write logger tests (`backend/test/logger.test.js`)
  - Test: Logger outputs JSON in production mode
  - Test: Logger outputs pretty in development mode
  - Test: Child logger inherits service field
  - Test: Security logger hashes email
  - **Verification**: All logger tests pass

- [ ] 9.2 Write middleware tests (`backend/test/middleware.test.js`)
  - Test: TraceId extracted from header
  - Test: TraceId generated if missing
  - Test: TraceId in response header
  - Test: Request logger emits correct structure
  - **Verification**: All middleware tests pass

- [ ] 9.3 Write health check tests (`backend/app.test.js`)
  - Test: GET /health → 200, status ok
  - Test: GET /health/ready → 200 when deps healthy
  - Test: GET /health/ready → 503 when DB unhealthy
  - **Verification**: All health tests pass

### 10. Documentation

- [ ] 10.1 Document logging architecture in AGENTS.md
  - **Verification**: AGENTS.md updated

- [ ] 10.2 Create logging troubleshooting guide
  - Common issues: ES connection, index template, Logstash parsing
  - **Verification**: Guide exists

## Progress Tracking

| Task Group | Status | Completed | Total |
|------------|--------|-----------|-------|
| Core Logger | Pending | 0 | 3 |
| Request Logging | Pending | 0 | 2 |
| Health Check | Pending | 0 | 2 |
| Better Auth Logging | Pending | 0 | 1 |
| Logstash Pipeline | Pending | 0 | 1 |
| Kibana Dashboards | Pending | 0 | 1 |
| ES Index Management | Pending | 0 | 1 |
| Feature Integration | Pending | 0 | 3 |
| Tests | Pending | 0 | 3 |
| Documentation | Pending | 0 | 2 |
| **Total** | | **0** | **19** |

## Notes

- ELK stack runs via Docker Compose (feature 005) - not required for development
- Logger works without ES (stdout only) for simple development
- Logstash optional - pino-elasticsearch can write directly to ES
- Kibana dashboards imported manually or via script in CI/CD
- Email hashing: use SHA-256 with salt for consistent but non-reversible hashing
- TraceId: use `crypto.randomUUID()` for generation, parse W3C `traceparent` header