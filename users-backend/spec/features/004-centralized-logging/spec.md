# Feature Specification: Centralized Logging (ELK Stack)

## Overview

**Feature ID**: 004-centralized-logging  
**Title**: Centralized Logging with ELK Stack  
**Status**: Draft  
**Priority**: P1 (High)

## Proposal Reference

See `spec/constitution/mission.md` - Core Principle: Observability by Default

## Requirements

### ADDED Requirements

#### Requirement: Structured JSON Logging

**Description**: All application logs emitted as structured JSON for parsing.

**Scenarios**:

##### Scenario: Log Format Standardization
- **WHEN** any log statement is emitted
- **THEN** log is JSON with fields: level, time, pid, hostname, service, traceId, spanId, msg, [context...]
- **AND** `service` field always set to `user-service`
- **AND** `traceId` and `spanId` propagated from request headers (W3C traceparent)

##### Scenario: Request Logging
- **WHEN** HTTP request received
- **THEN** log emitted with: method, url, statusCode, responseTime, userId (if authenticated), ip, userAgent
- **AND** log level: info for 2xx/3xx, warn for 4xx, error for 5xx

##### Scenario: Security Event Logging
- **WHEN** authentication events occur (login, logout, failed attempts, password reset)
- **THEN** log emitted with: eventType, userId, email (hashed), ip, userAgent, success, reason
- **AND** log level: info for success, warn for failures, error for security incidents

##### Scenario: Error Logging
- **WHEN** unhandled error or caught error logged
- **THEN** log emitted with: error.message, error.stack, error.code, context
- **AND** log level: error
- **AND** traceId included for correlation

#### Requirement: Elasticsearch Transport

**Description**: Stream logs to Elasticsearch via pino-elasticsearch.

**Scenarios**:

##### Scenario: Elasticsearch Connection
- **WHEN** application starts with `ELASTICSEARCH_NODE` configured
- **THEN** pino-elasticsearch transport connects to Elasticsearch
- **AND** logs batched (flushBytes: 1000, flushInterval: 30000)
- **AND** connection errors logged but don't crash app

##### Scenario: Index Management
- **WHEN** logs sent to Elasticsearch
- **THEN** index pattern: `user-service-logs-%{YYYY.MM.DD}`
- **AND** index template applied for field mappings
- **AND** ILM policy: rollover at 50GB or 7 days, delete after 30 days

##### Scenario: Dynamic Index Naming
- **WHEN** in development
- **THEN** index: `user-service-logs-dev`
- **WHEN** in production
- **THEN** index: `user-service-logs-prod-%{YYYY.MM.DD}`

#### Requirement: Logstash Pipeline (Optional Enhancement)

**Description**: Process and enrich logs via Logstash before Elasticsearch.

**Scenarios**:

##### Scenario: Log Enrichment
- **WHEN** logs pass through Logstash
- **THEN** add geoip from IP address
- **AND** parse userAgent for browser/OS/device
- **AND** add Kubernetes metadata (pod, namespace) if running in K8s

##### Scenario: Sensitive Data Redaction
- **WHEN** logs contain sensitive fields
- **THEN** Logstash redacts: password, token, authorization, cookie, creditCard
- **AND** replacement: `[REDACTED]`

#### Requirement: Kibana Dashboards

**Description**: Pre-built dashboards for observability.

**Scenarios**:

##### Scenario: Auth Events Dashboard
- **WHEN** viewing Kibana
- **THEN** dashboard shows: login success/failure rates, registration trends, password resets, brute force attempts
- **AND** time range selector, auto-refresh

##### Scenario: Error Analysis Dashboard
- **WHEN** viewing Kibana
- **THEN** dashboard shows: error rates by endpoint, error types, stack traces, affected users
- **AND** drill-down to individual logs

##### Scenario: Performance Dashboard
- **WHEN** viewing Kibana
- **THEN** dashboard shows: p50/p95/p99 response times, throughput, slow endpoints
- **AND** percentile aggregations

#### Requirement: Health Check Logging

**Description**: Log health check results for monitoring.

**Scenarios**:

##### Scenario: Health Check Endpoint
- **WHEN** GET `/health` called
- **THEN** returns 200 with `{ status: 'ok', checks: { database, elasticsearch } }`
- **AND** logs health check result (debug level)

##### Scenario: Dependency Health
- **WHEN** health check runs
- **THEN** verifies: database connectivity, Elasticsearch connectivity
- **AND** returns 503 if any critical dependency unhealthy

### MODIFIED Requirements

- **Feature 001-registration**: Registration events now include traceId
- **Feature 002-authentication**: Auth events now include traceId, structured format
- **Feature 003-profile-management**: Profile events now include traceId

### REMOVED Requirements

None

## Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-001 | All logs are valid JSON with required fields | Log inspection |
| AC-002 | traceId propagated from request headers | Integration test |
| AC-003 | Logs appear in Elasticsearch within 5 seconds | Manual verification |
| AC-004 | Index pattern matches `user-service-logs-*` | Elasticsearch API |
| AC-005 | Kibana dashboards show auth, error, performance data | Kibana UI |
| AC-006 | Sensitive fields redacted in Logstash | Log inspection |
| AC-007 | Health endpoint returns dependency status | Integration test |
| AC-008 | Works in development (no ELK) and production (with ELK) | Both environments |

## Dependencies

- **Pino**: Base logger
- **pino-elasticsearch**: Elasticsearch transport
- **Elasticsearch**: 8.x (single-node dev, cluster prod)
- **Logstash**: 8.x (optional enrichment)
- **Kibana**: 8.x (visualization)
- **Docker Compose**: Local ELK stack (feature 005)

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Logging overhead < 5% CPU |
| Reliability | Log transport failures don't crash app |
| Security | No sensitive data in logs (passwords, tokens) |
| Cost | Log retention: 30 days default, configurable |
| Scalability | Elasticsearch handles 10k logs/sec |

## Open Questions

1. Logstash required or pino-elasticsearch direct to ES?
2. OpenTelemetry integration for distributed tracing?
3. Alerting rules (ElastAlert, Watcher, or external)?
4. Multi-service log correlation (shared traceId)?