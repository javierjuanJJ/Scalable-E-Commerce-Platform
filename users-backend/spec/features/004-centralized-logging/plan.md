# Implementation Plan: Centralized Logging (ELK Stack)

## Overview

**Feature**: 004-centralized-logging  
**Depends On**: 001-registration, 002-authentication, 003-profile-management (for log integration)  
**Enables**: 005-docker-compose (ELK stack in Docker)

## Architecture Decisions

### 1. Logger Architecture
```
Application Code
    ↓
Pino Logger (lib/logger.js)
    ↓
┌─────────────────────────────────┐
│  Development: Pretty Print      │
│  Production: JSON + ES Transport│
└─────────────────────────────────┘
```

### 2. Pino-Elasticsearch Transport Configuration
- Conditional: only enabled when `ELASTICSEARCH_NODE` env var set
- Batch settings: `flushBytes: 1000`, `flushInterval: 30000`
- Index pattern: `user-service-logs-${env}-%{DATE}`
- Error handling: emit `insertError` event, log but don't crash

### 3. Request/Response Logging Middleware
- Custom middleware using `pino-http` or manual implementation
- Generates/extracts `traceId` from `traceparent` header (W3C)
- Logs at response finish with timing, status, user context

### 4. Security Event Logger
- Child logger: `logger.child({ component: 'security' })`
- Structured events: `auth.login`, `auth.logout`, `auth.failed`, `auth.reset`
- Fields: `eventType`, `userId`, `emailHash`, `ip`, `userAgent`, `success`, `reason`

### 5. Health Check Endpoint
- `GET /health` returns service status + dependency checks
- Checks: database (JSON file read / Prisma query), Elasticsearch (cluster health)
- Returns 200 if healthy, 503 if degraded

### 6. Logstash Pipeline (Development Optional)
- Input: beats (filebeat) or direct HTTP
- Filters: geoip, useragent parse, kubernetes metadata, sensitive data redaction
- Output: Elasticsearch

### 7. Kibana Dashboard Setup
- Saved searches for common queries
- Visualizations: line charts (rates), tables (errors), metrics (percentiles)
- Dashboard with time picker, auto-refresh (30s)

## Data Flow

### Request Logging
```
HTTP Request
    ↓
Extract/Generate traceId
    ↓
Start timer
    ↓
Request Logger Middleware (logs request start - debug)
    ↓
Route Handler
    ↓
Response Finish
    ↓
Request Logger Middleware (logs completion with timing)
    ↓
If ES configured → pino-elasticsearch → Elasticsearch
```

### Security Event
```
Auth Controller
    ↓
securityLogger.info({ eventType: 'auth.login', userId, emailHash, ip, success })
    ↓
Pino → Elasticsearch
```

## Better Auth Integration

```javascript
// lib/auth.js - extend callbacks for logging
const auth = betterAuth({
  // ... config
  hooks: {
    afterSignUp: async (user) => {
      logger.info({ eventType: 'auth.register', userId: user.id, email: user.email }, 'User registered');
    },
    afterSignIn: async (user, session) => {
      logger.info({ eventType: 'auth.login', userId: user.id, email: user.email }, 'User logged in');
    },
    afterSignOut: async (session) => {
      logger.info({ eventType: 'auth.logout', userId: session.userId }, 'User logged out');
    },
  },
});
```

## Error Handling

- Transport errors: logged to stderr, app continues
- Elasticsearch unavailable: queue in memory (limited), retry
- Logstash unavailable: direct to ES fallback
- Field mapping conflicts: dynamic templates handle new fields

## Testing Strategy

### Unit Tests
- Logger configuration (pretty vs JSON)
- TraceId extraction/generation
- Security event structure
- Health check dependency checks

### Integration Tests
- Request logging middleware emits correct structure
- Logs appear in Elasticsearch (when running)
- Health endpoint returns correct status
- Sensitive data not in logs

### Manual Verification
- Kibana dashboards render correctly
- Index lifecycle management works
- Log retention policy enforced

## File Structure Impact

```
backend/
├── lib/
│   ├── logger.js            # Pino configuration + ES transport
│   └── security-logger.js   # Child logger for auth events
├── middlewares/
│   ├── request-logger.js    # HTTP request/response logging
│   └── trace-id.js          # TraceId extraction/generation
├── routes/
│   └── health.js            # GET /health
├── logstash/
│   └── pipeline/
│       └── logstash.conf    # Logstash pipeline config
├── kibana/
│   └── dashboards/          # Exported dashboard JSON
└── test/
    └── logging.test.js      # Logging tests
```

## Elasticsearch Index Template

```json
{
  "index_patterns": ["user-service-logs-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.lifecycle.name": "user-service-logs-policy",
      "index.lifecycle.rollover_alias": "user-service-logs"
    },
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "level": { "type": "keyword" },
        "service": { "type": "keyword" },
        "traceId": { "type": "keyword" },
        "spanId": { "type": "keyword" },
        "msg": { "type": "text" },
        "eventType": { "type": "keyword" },
        "userId": { "type": "keyword" },
        "emailHash": { "type": "keyword" },
        "ip": { "type": "ip" },
        "method": { "type": "keyword" },
        "url": { "type": "keyword" },
        "statusCode": { "type": "integer" },
        "responseTime": { "type": "float" },
        "error": { "type": "object", "enabled": true }
      }
    }
  }
}
```

## ILM Policy

```json
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": { "max_size": "50GB", "max_age": "7d" }
        }
      },
      "delete": {
        "min_age": "30d",
        "actions": { "delete": {} }
      }
    }
  }
}
```

## Configuration

```env
# Logging
LOG_LEVEL=info                    # debug, info, warn, error
LOG_PRETTY=true                   # development only
ELASTICSEARCH_NODE=http://localhost:9200
LOG_INDEX=user-service-logs-%{DATE}
LOG_FLUSH_BYTES=1000
LOG_FLUSH_INTERVAL=30000

# Logstash (optional)
LOGSTASH_HOST=localhost
LOGSTASH_PORT=5044

# Health Check
HEALTH_CHECK_DB=true
HEALTH_CHECK_ES=true
```

## Migration Considerations

- JSON MVP: logs to file + ES if configured
- Prisma/PostgreSQL: same logging, health check queries database
- Kubernetes: add `k8s-pod`, `k8s-namespace` fields via Logstash or node metadata

## Rollback Plan

If ELK stack issues:
1. Disable ES transport: remove `ELASTICSEARCH_NODE` env
2. Logs remain in stdout (captured by Docker/k8s logging)
3. Use `kubectl logs` or `docker logs` for debugging
4. Estimated effort: 0 (configuration only)