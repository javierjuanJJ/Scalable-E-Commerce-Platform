# Spec: Centralized Logging (ELK Stack)

## Feature Overview
**Feature ID**: 004
**Name**: Centralized Logging
**Description**: Aggregate logs from all microservices using ELK Stack (Elasticsearch, Logstash, Kibana) with ECS format

## User Stories

### US-001: Structured Application Logging
**As a** developer  
**I want to** log in structured ECS format  
**So that** logs are queryable in Elasticsearch

**Acceptance Criteria**:
- All services use Winston logger with ECS formatter
- Log fields: @timestamp, service.name, event.action, event.outcome, log.level, message, trace.id, span.id
- Context enrichment: user.id, request.id, product.id, etc.
- No console.log in production code

### US-002: Log Shipping to Logstash
**As a** developer  
**I want to** ship logs to Logstash  
**So that** they're centralized in Elasticsearch

**Acceptance Criteria**:
- Winston transport to Logstash (TCP/TLS)
- Batch sending with configurable buffer
- Graceful degradation if Logstash unavailable
- Retry with exponential backoff
- Local file fallback for development

### US-003: Request/Response Logging
**As a** developer  
**I want to** log all HTTP requests/responses  
**So that** I can debug and monitor API

**Acceptance Criteria**:
- Express middleware logs every request
- Fields: http.request.method, url.path, http.response.status_code, duration.ms, user.id
- Request body logged for POST/PATCH (sanitized: no passwords, tokens)
- Response body logged for errors only
- Correlation via traceparent header

### US-004: Error Logging with Context
**As a** developer  
**I want to** log errors with full context  
**So that** I can diagnose issues quickly

**Acceptance Criteria**:
- Global error handler logs all unhandled errors
- Includes: error.message, error.stack, error.code, request context
- 5xx errors: log.error with full context
- 4xx errors: log.warn with validation details
- Correlation ID propagated

### US-005: Kibana Dashboards
**As a** operator  
**I want to** visualize logs in Kibana  
**So that** I can monitor system health

**Acceptance Criteria**:
- Pre-built dashboards for:
  - Request rate, latency, error rate (RED metrics)
  - Error breakdown by service, endpoint, code
  - Trace timeline for distributed tracing
  - Business events (orders, inventory, users)
- Index patterns: `catalog-logs-*`, `catalog-metrics-*`
- Saved searches for common queries

### US-006: Log Retention & Rotation
**As a** operator  
**I want to** manage log retention  
**So that** storage costs are controlled

**Acceptance Criteria**:
- Elasticsearch ILM policy: hot (7d), warm (30d), cold (90d), delete (1y)
- Logstash pipeline: parse, enrich, route to correct index
- Kibana spaces per team (platform, product, infra)

## Technical Specification

### ECS Field Mapping (Winston → Elasticsearch)

```typescript
interface ECSLogEntry {
  '@timestamp': string;           // ISO 8601
  'ecs.version': string;          // "8.11.0"
  'service.name': string;         // "product-catalogue"
  'service.version': string;      // "1.0.0"
  'event.action': string;         // "product.list", "inventory.reserve"
  'event.outcome': 'success' | 'failure';
  'event.duration': number;       // nanoseconds
  'log.level': 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  'message': string;              // Human-readable
  'trace.id': string;             // W3C trace-id
  'span.id': string;              // W3C span-id
  'process.pid': number;
  'host.name': string;
  
  // HTTP fields (when applicable)
  'http.request.method'?: string;
  'url.path'?: string;
  'url.query'?: string;
  'http.response.status_code'?: number;
  'http.request.body.content'?: object;  // Sanitized
  'http.response.body.content'?: object; // Errors only
  
  // User context
  'user.id'?: string;
  'user.roles'?: string[];
  
  // Business context
  'product.id'?: string;
  'category.id'?: string;
  'order.id'?: string;
  'inventory.location_id'?: string;
  
  // Error fields
  'error.type'?: string;
  'error.message'?: string;
  'error.stack_trace'?: string;
  'error.code'?: string;
}
```

### Logger Configuration

```typescript
// backend/src/utils/logger.ts
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    ecsFormat()  // Custom ECS formatter
  ),
  defaultMeta: {
    'service.name': 'product-catalogue',
    'service.version': process.env.APP_VERSION,
    'ecs.version': '8.11.0',
    'host.name': os.hostname(),
    'process.pid': process.pid
  },
  transports: [
    // Development: console with pretty print
    ...(isDev ? [new winston.transports.Console({ format: prettyPrint() })] : []),
    
    // Production: Logstash TCP
    new winston.transports.Logstash({
      host: process.env.LOGSTASH_HOST || 'localhost',
      port: parseInt(process.env.LOGSTASH_PORT) || 5044,
      protocol: 'tcp',
      tls: process.env.LOGSTASH_TLS === 'true',
      maxBatchSize: 100,
      maxRetries: 5,
      retryInterval: 1000
    }),
    
    // Fallback: rotating file
    new winston.transports.DailyRotateFile({
      dirname: 'logs',
      filename: 'application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '100m',
      maxFiles: '30d',
      format: winston.format.json()
    })
  ]
});
```

### Logstash Pipeline Configuration

```ruby
# logstash/pipeline/catalog.conf
input {
  tcp {
    host => "0.0.0.0"
    port => 5044
    codec => json_lines
    ssl_enable => true
    ssl_cert => "/certs/logstash.crt"
    ssl_key => "/certs/logstash.key"
  }
}

filter {
  # Parse @timestamp
  date {
    match => ["@timestamp", "ISO8601"]
    target => "@timestamp"
  }
  
  # Add service type for routing
  if [service][name] == "product-catalogue" {
    mutate { add_field => { "service_type" => "catalog" } }
  }
  
  # Enrich with GeoIP for client IPs
  if [client][ip] {
    geoip {
      source => "[client][ip]"
      target => "geoip"
    }
  }
  
  # Sanitize sensitive fields
  ruby {
    code => "
      SENSITIVE = ['password', 'token', 'secret', 'authorization', 'cookie', 'credit_card', 'ssn']
      def sanitize(hash)
        hash.each do |k, v|
          if SENSITIVE.any? { |s| k.downcase.include?(s) }
            hash[k] = '[REDACTED]'
          elsif v.is_a?(Hash)
            sanitize(v)
          end
        end
      end
      sanitize(event.to_hash)
    "
  }
}

output {
  # Route to service-specific indices
  if [service_type] == "catalog" {
    elasticsearch {
      hosts => ["elasticsearch:9200"]
      index => "catalog-logs-%{+YYYY.MM.dd}"
      ilm_enabled => true
      ilm_policy_id => "catalog-logs-policy"
    }
  }
  
  # Dead letter queue for failed
  dead_letter_queue {
    path => "/usr/share/logstash/dlq"
  }
}
```

### Elasticsearch ILM Policy

```json
PUT _ilm/policy/catalog-logs-policy
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": { "max_size": "50gb", "max_age": "7d" },
          "set_priority": { "priority": 100 }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "readonly": {},
          "forcemerge": { "max_num_segments": 1 },
          "shrink": { "number_of_shards": 1 },
          "set_priority": { "priority": 50 }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "freeze": {},
          "set_priority": { "priority": 0 }
        }
      },
      "delete": {
        "min_age": "365d",
        "actions": { "delete": {} }
      }
    }
  }
}
```

### Docker Compose for ELK Stack

```yaml
# docker/elk/docker-compose.yml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./pipeline:/usr/share/logstash/pipeline:ro
      - ./certs:/certs:ro
    ports:
      - "5044:5044"
      - "9600:9600"
    environment:
      - LS_JAVA_OPTS=-Xms512m -Xmx512m
    depends_on:
      elasticsearch:
        condition: service_healthy

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      elasticsearch:
        condition: service_healthy

volumes:
  elasticsearch_data:
```

## Implementation Steps

1. **Logger Utility**: Winston + ECS formatter + transports
2. **Express Middleware**: Request/response logging
3. **Error Handler**: Global error logging
4. **Logstash Pipeline**: Parse, enrich, route
5. **Elasticsearch ILM**: Retention policies
6. **Kibana Dashboards**: Pre-built visualizations
7. **Docker Compose**: ELK stack for local/prod
8. **Integration**: Wire into all services
9. **Tests**: Verify log format, shipping, dashboards

## File Structure
```
backend/src/
├── utils/
│   ├── logger.ts              # Winston ECS logger
│   ├── ecsFormatter.ts        # Custom ECS format
│   └── sanitize.ts            # Sensitive field redaction
├── middleware/
│   ├── requestLogger.ts       # HTTP request/response logging
│   └── errorLogger.ts         # Global error logging
├── config/
│   └── logging.ts             # Configuration
└── types/
    └── logging.ts             # ECS log types

docker/elk/
├── docker-compose.yml
├── pipeline/
│   └── catalog.conf
├── certs/
│   ├── logstash.crt
│   └── logstash.key
└── kibana/
    └── dashboards.ndjson      # Exported dashboards
```

## Non-Functional Requirements

- **Latency Impact**: < 5ms overhead per request
- **Throughput**: Logstash handles 10k events/sec
- **Reliability**: At-least-once delivery, DLQ for failures
- **Security**: TLS for Logstash, no secrets in logs
- **Cost**: ILM reduces storage 80% after 30 days

## Dependencies
- **005-docker-compose**: ELK stack runs in containers
- **006-develop-microservices**: All services use same logger

## Out of Scope
- APM/Traces (separate: Elastic APM)
- Metrics collection (Prometheus/Grafana)
- Alerting (Elastic Watcher or separate)
- Log-based anomaly detection