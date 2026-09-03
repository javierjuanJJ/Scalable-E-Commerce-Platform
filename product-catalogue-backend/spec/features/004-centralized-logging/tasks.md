# Tasks: Centralized Logging (ELK Stack)

## Phase 1: Core Logger Implementation

- [ ] **T001** Create ECS log types (`backend/src/types/logging.ts`)
  - ECSLogEntry interface with all fields
  - LogContext interface for dynamic fields
  - ServiceMetadata interface

- [ ] **T002** Create sanitization utility (`backend/src/utils/sanitize.ts`)
  - `sanitizeObject(obj, sensitivePatterns?)` - recursive redaction
  - Default patterns: password, token, secret, authorization, cookie, credit_card, ssn
  - Configurable via environment
  - Unit tests for nested objects, arrays, edge cases

- [ ] **T003** Create ECS formatter (`backend/src/utils/ecsFormatter.ts`)
  - `ecsFormat()` Winston format function
  - Maps: level → log.level, message → message, timestamp → @timestamp
  - Adds: ecs.version, service metadata, process/host info
  - Handles Error objects (error.message, error.stack, error.type)
  - Unit tests for all log levels, error objects, context merging

- [ ] **T004** Create Winston logger (`backend/src/utils/logger.ts`)
  - Factory function `createLogger(serviceName, options?)`
  - Default meta: service.name, service.version, ecs.version, host, pid
  - Transports: Console (dev), Logstash (prod), DailyRotateFile (fallback)
  - Logstash transport: batching, retries, TLS, reconnection
  - Context methods: `setContext()`, `clearContext()`, `child()`
  - Export singleton `logger` for app-wide use

- [ ] **T005** Create logging config (`backend/src/config/logging.ts`)
  - Environment-based configuration
  - Validate required prod settings (LOGSTASH_HOST, etc.)
  - Type-safe config object

- [ ] **T006** Write logger unit tests (`backend/tests/unit/logger.test.ts`)
  - ECS format output verification
  - Default metadata presence
  - Transport selection (dev vs prod)
  - Context management
  - Sanitization integration
  - Error object serialization

## Phase 2: Express Middleware

- [ ] **T007** Create request logger middleware (`backend/src/middleware/requestLogger.ts`)
  - Extract/generate traceparent (W3C format)
  - Log request start: method, path, query, headers (sanitized), ip, user-agent
  - Log request end: status, duration, response size
  - Sanitize request body (POST/PATCH/PUT)
  - Log response body only for errors (status >= 400)
  - Attach logger to `req.log` for route handlers
  - Skip health check endpoints (/health, /ready)

- [ ] **T008** Create error logger middleware (`backend/src/middleware/errorLogger.ts`)
  - Global error handler (4 params)
  - Determine log level: error (5xx), warn (4xx)
  - Enrich with: trace.id, span.id, request context, user context
  - Log error: message, stack, code, cause
  - Don't log validation errors as errors (they're expected)
  - Pass to next error handler

- [ ] **T009** Write middleware unit tests (`backend/tests/unit/middleware/`)
  - requestLogger: trace context, logging format, sanitization, skip paths
  - errorLogger: level selection, context enrichment, error serialization

## Phase 3: Logstash & Elasticsearch

- [ ] **T010** Create Logstash pipeline (`docker/elk/pipeline/catalog.conf`)
  - TCP input with JSON codec, TLS
  - Date filter for @timestamp
  - Service type routing (catalog, users, orders, etc.)
  - GeoIP filter for client.ip
  - Ruby sanitize filter (defense in depth)
  - Elasticsearch output with ILM
  - Dead letter queue configuration

- [ ] **T011** Generate TLS certificates (`docker/elk/certs/generate-certs.sh`)
  - Self-signed CA
  - Logstash server cert/key
  - Elasticsearch cert (if needed)
  - Document renewal process

- [ ] **T012** Create ELK Docker Compose (`docker/elk/docker-compose.yml`)
  - Elasticsearch 8.11: single-node, security disabled, JVM heap 1g
  - Logstash 8.11: pipeline mount, certs mount, JVM heap 512m
  - Kibana 8.11: elasticsearch host, port 5601
  - Healthchecks for all services
  - Networks: elk-network
  - Volumes: elasticsearch_data

- [ ] **T013** Create ILM policy (apply via API or Logstash)
  - Policy: catalog-logs-policy
  - Hot: 7d/50GB, rollover
  - Warm: 30d, forcemerge, shrink
  - Cold: 90d, freeze
  - Delete: 365d

- [ ] **T014** Create index templates (`docker/elk/pipeline/index-template.json`)
  - Template: catalog-logs-*
  - Mappings: ECS field types (keyword, date, long, ip, geo_point)
  - Settings: number_of_shards, refresh_interval

## Phase 4: Kibana Dashboards

- [ ] **T015** Build Kibana dashboards (in Kibana UI, then export)
  - Dashboard 1: Catalog Overview (RED metrics)
  - Dashboard 2: Error Analysis (by service, endpoint, code)
  - Dashboard 3: Business Events (product, inventory, orders)
  - Dashboard 4: Distributed Tracing (trace timeline)
  - Dashboard 5: Infrastructure (host, container)
  - Save as `dashboards.ndjson`

- [ ] **T016** Create index patterns (`docker/elk/kibana/index-patterns.ndjson`)
  - Pattern: catalog-logs-*
  - Time field: @timestamp
  - Field formatters

- [ ] **T017** Add Kibana auto-import on startup
  - Kibana saved objects API
  - Script to import dashboards/patterns

## Phase 5: Integration & Configuration

- [ ] **T018** Wire logger into product-catalogue service
  - Replace all console.log with logger
  - Add requestLogger middleware to Express app
  - Add errorLogger middleware (last)
  - Configure via environment variables

- [ ] **T019** Create shared logging package (optional)
  - `@ecommerce/logger` package for reuse across services
  - Publish to private registry

- [ ] **T020** Update docker-compose.yml for product-catalogue
  - Add LOGSTASH_HOST, LOGSTASH_PORT, LOGSTASH_TLS
  - Depend on logstash service
  - Join elk-network

## Phase 6: Testing & Verification

- [ ] **T021** Write integration tests (`backend/tests/integration/logging.integration.test.ts`)
  - Make HTTP request, verify log output format
  - Verify trace context propagation
  - Verify sanitization works
  - Verify error logging

- [ ] **T022** Test ELK stack locally
  - `docker compose -f docker/elk/docker-compose.yml up -d`
  - Verify Elasticsearch health (green)
  - Verify Logstash pipeline running
  - Verify Kibana accessible
  - Send test log, verify in Kibana Discover

- [ ] **T023** Test log shipping from service
  - Start product-catalogue with ELK
  - Make requests
  - Verify logs in Kibana Discover
  - Verify dashboards show data

- [ ] **T024** Test ILM policy
  - Wait for rollover (or force)
  - Verify index lifecycle phases

## Phase 7: Documentation

- [ ] **T025** Create logging guide (`docs/logging-guide.md`)
  - How to use logger in services
  - Adding custom context
  - Log levels guidance
  - Troubleshooting

- [ ] **T026** Document ELK stack operations
  - Scaling Elasticsearch
  - Logstash pipeline tuning
  - Kibana dashboard management
  - Certificate renewal

- [ ] **T027** Add to main README
  - ELK stack quickstart
  - Environment variables reference

## Definition of Done
- [ ] All tasks completed
- [ ] Unit tests > 80% coverage
- [ ] Integration tests pass
- [ ] ELK stack runs locally via docker-compose
- [ ] Logs visible in Kibana
- [ ] Dashboards functional
- [ ] No sensitive data in logs
- [ ] Code review approved
- [ ] Documentation complete