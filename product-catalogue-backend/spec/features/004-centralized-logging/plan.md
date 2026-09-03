# Plan: Centralized Logging (ELK Stack)

## Technical Approach

### Logger Implementation
**Winston with ECS Format**:
- Custom `ecsFormat()` transforms Winston log to ECS schema
- Default metadata: service.name, version, ecs.version, host, pid
- Dynamic context: trace.id, span.id from request headers
- Sanitization: Redact passwords, tokens, secrets recursively

**Transports**:
1. **Development**: Console with pretty-print (colors, human-readable)
2. **Production**: Logstash TCP transport with batching, retries, TLS
3. **Fallback**: Daily rotating JSON files (survives Logstash downtime)

### Request Logging Middleware
- Generate/extract `trace.id` and `span.id` from `traceparent` header
- Log request start (info): method, path, query, user-agent, ip
- Log request end (info/error): status, duration, response size
- Sanitize request body (remove sensitive fields)
- Log response body only for errors (4xx, 5xx)

### Error Logging
- Global error handler catches all unhandled errors
- Log at `error` level for 5xx, `warn` for 4xx
- Include: error.message, error.stack, error.code, request context
- Correlation: trace.id, span.id, request.id

### Logstash Pipeline
**Input**: TCP/JSON on port 5044 with TLS
**Filters**:
- Date parsing for @timestamp
- Service type routing
- GeoIP enrichment for client IPs
- Ruby sanitization for sensitive fields
- Field renaming for ECS compliance
**Output**: Elasticsearch with ILM, DLQ for failures

### Elasticsearch Index Lifecycle
- **Hot**: 7 days, 50GB max, priority 100
- **Warm**: 30 days, forcemerge, shrink, priority 50
- **Cold**: 90 days, freeze, priority 0
- **Delete**: 365 days

### Kibana Dashboards
Pre-built dashboards (exported as NDJSON):
1. **Catalog Overview**: Request rate, p50/p95/p99 latency, error rate
2. **Error Analysis**: Errors by service, endpoint, status code, time
3. **Business Events**: Product views, cart adds, orders, inventory changes
4. **Distributed Tracing**: Trace timeline, service map
5. **Infrastructure**: Host, process, container metrics

## Implementation Steps

1. **Core Logger** (`backend/src/utils/logger.ts`)
   - Winston setup with ECS formatter
   - Multi-transport configuration
   - Context management (trace, user, business)

2. **ECS Formatter** (`backend/src/utils/ecsFormatter.ts`)
   - Map Winston log to ECS fields
   - Handle nested objects, errors, timestamps

3. **Sanitization** (`backend/src/utils/sanitize.ts`)
   - Recursive field redaction
   - Configurable sensitive field patterns

4. **Request Middleware** (`backend/src/middleware/requestLogger.ts`)
   - Trace context extraction/generation
   - Request/response logging
   - Body sanitization

5. **Error Middleware** (`backend/src/middleware/errorLogger.ts`)
   - Global error capture
   - Context enrichment
   - Level selection by status code

6. **Logstash Pipeline** (`docker/elk/pipeline/catalog.conf`)
   - Input, filters, output
   - TLS configuration
   - DLQ setup

7. **ELK Docker Compose** (`docker/elk/docker-compose.yml`)
   - Elasticsearch, Logstash, Kibana
   - Volumes, networks, healthchecks
   - Certificates for TLS

8. **ILM Policy** (applied via Logstash or API)
   - Hot/warm/cold/delete phases
   - Rollover conditions

9. **Kibana Dashboards** (`docker/elk/kibana/dashboards.ndjson`)
   - Export from Kibana Dev Tools
   - Import on startup

10. **Integration** - Wire logger into all services
    - Replace console.log
    - Add middleware to Express apps
    - Configure via environment

11. **Tests** - Verify log format, shipping, dashboards

## Configuration

### Environment Variables
```env
LOG_LEVEL=info
LOGSTASH_HOST=logstash
LOGSTASH_PORT=5044
LOGSTASH_TLS=true
ELASTICSEARCH_HOST=elasticsearch
ELASTICSEARCH_PORT=9200
KIBANA_HOST=kibana
KIBANA_PORT=5601
APP_VERSION=1.0.0
SENSITIVE_FIELDS=password,token,secret,authorization,cookie,credit_card,ssn
```

### Docker Compose Integration
```yaml
# In main docker-compose.yml
services:
  product-catalogue:
    environment:
      - LOGSTASH_HOST=logstash
      - LOGSTASH_PORT=5044
      - LOGSTASH_TLS=true
    depends_on:
      logstash:
        condition: service_healthy
    networks:
      - elk-network

networks:
  elk-network:
    external: true
```

## Testing Strategy

### Unit Tests
- `logger.test.ts` - ECS format output, default meta, level filtering
- `ecsFormatter.test.ts` - Field mapping, error serialization, nested objects
- `sanitize.test.ts` - Redaction patterns, nested objects, arrays
- `requestLogger.test.ts` - Trace context, request/response logging, sanitization
- `errorLogger.test.ts` - Error capture, level selection, context

### Integration Tests
- `logging.integration.test.ts` - Full request flow with log output verification
- `logstash.shipping.test.ts` - Verify logs reach Logstash (test container)
- `elasticsearch.indexing.test.ts` - Verify index creation, ILM

### Dashboard Tests
- Verify dashboard NDJSON imports without errors
- Check visualizations render with sample data

## File Structure
```
backend/src/
├── utils/
│   ├── logger.ts
│   ├── ecsFormatter.ts
│   └── sanitize.ts
├── middleware/
│   ├── requestLogger.ts
│   └── errorLogger.ts
├── config/
│   └── logging.ts
└── types/
    └── logging.ts

docker/elk/
├── docker-compose.yml
├── pipeline/
│   └── catalog.conf
├── certs/
│   ├── generate-certs.sh
│   ├── logstash.crt
│   └── logstash.key
└── kibana/
    ├── dashboards.ndjson
    └── index-patterns.ndjson

backend/tests/
├── unit/
│   ├── logger.test.ts
│   ├── ecsFormatter.test.ts
│   ├── sanitize.test.ts
│   ├── requestLogger.test.ts
│   └── errorLogger.test.ts
└── integration/
    └── logging.integration.test.ts
```

## Monitoring & Observability

### Logstash Metrics (via monitoring API)
- Events received/sent/failed
- Queue size, batch latency
- DLQ size

### Elasticsearch Metrics
- Index size, document count
- Search latency
- ILM phase transitions

### Kibana Metrics
- Dashboard load time
- Query performance

## Definition of Done
- [ ] All services log in ECS format
- [ ] Logs ship to Logstash → Elasticsearch
- [ ] Kibana dashboards operational
- [ ] ILM policies applied
- [ ] TLS configured for Logstash
- [ ] Sensitive data redacted
- [ ] Tests pass in CI
- [ ] Documentation complete