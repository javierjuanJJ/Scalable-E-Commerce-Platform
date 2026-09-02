# Implementation Plan: Docker & Docker Compose

## Overview

**Feature**: 005-docker-compose  
**Depends On**: 001-registration, 002-authentication, 003-profile-management, 004-centralized-logging (for ELK stack services)

## Architecture Decisions

### 1. Dockerfile Strategy: Multi-Stage Build

```
# Stage 1: Base / Dependencies
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build (TypeScript compilation)
FROM base AS builder
RUN npm ci  # Install dev deps
COPY . .
RUN npm run build

# Stage 3: Runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1
CMD ["node", "dist/backend/app.js"]
```

### 2. Docker Compose Structure

```
compose.yaml           # Base configuration (shared)
compose.dev.yaml       # Development overrides
compose.prod.yaml      # Production overrides
compose.logging.yaml   # ELK stack (optional profile)
```

### 3. Service Definitions

#### Base compose.yaml
```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      - ELASTICSEARCH_NODE=http://elasticsearch:9200
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
      elasticsearch:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health/live"]
      interval: 30s
      timeout: 3s
      retries: 3

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.15.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - es_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
      - "9300:9300"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5

  kibana:
    image: docker.elastic.co/kibana/kibana:8.15.0
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    ports:
      - "5601:5601"
    depends_on:
      elasticsearch:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:5601/api/status || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  es_data:
```

#### Development Override (compose.dev.yaml)
```yaml
services:
  app:
    build:
      target: builder  # Use build stage with dev deps
    command: npm run dev
    volumes:
      - .:/app
      - /app/node_modules  # Anonymous volume to preserve container node_modules
    environment:
      - NODE_ENV=development
      - LOG_PRETTY=true
    ports:
      - "3000:3000"
      - "9229:9229"  # Debug port
    # No healthcheck in dev (conflicts with hot reload)

  db:
    # No volume mount - ephemeral for clean slate each run
    # Or use tmpfs for speed

  elasticsearch:
    # Already single-node, no security - good for dev
```

#### Production Override (compose.prod.yaml)
```yaml
services:
  app:
    build:
      target: runner
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  db:
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          memory: 1G

  elasticsearch:
    environment:
      - xpack.security.enabled=true
      - ELASTIC_PASSWORD=${ELASTIC_PASSWORD}
    # Add certificates via secrets/configs
    deploy:
      resources:
        limits:
          memory: 2G
```

### 4. .dockerignore
```
.git
.gitignore
.env
.env.*
!.env.example
node_modules
dist
coverage
*.log
npm-debug.log*
.DS_Store
*.pem
.vscode
.idea
README.md
docs
tests
```

### 5. Build Optimization

- **Cache Mounts**: Use `RUN --mount=type=cache,target=/root/.npm npm ci` for faster builds
- **Secret Mounts**: `RUN --mount=type=secret,id=npm_token` for private registries
- **Multi-arch**: `docker buildx build --platform linux/amd64,linux/arm64`

### 6. CI/CD Integration

```yaml
# .github/workflows/docker.yml
- Build multi-arch image with buildx
- Scan with Trivy
- Push to GHCR with tags: sha, branch, semver
- Sign with cosign
```

## Data Flow

### Development
```
docker compose -f compose.yaml -f compose.dev.yaml up
    ↓
Builds builder stage (with dev deps)
    ↓
Mounts source code
    ↓
Runs npm run dev (tsx watch)
    ↓
Hot reload on file changes
```

### Production
```
docker compose -f compose.yaml -f compose.prod.yaml up -d
    ↓
Builds runner stage (production only)
    ↓
Runs as non-root user
    ↓
Read-only filesystem
    ↓
Health checks active
```

## Configuration

### Environment Variables (.env)
```env
# Database
POSTGRES_DB=users
POSTGRES_USER=user
POSTGRES_PASSWORD=changeme

# Elasticsearch
ELASTIC_PASSWORD=changeme

# App
NODE_ENV=production
BETTER_AUTH_SECRET=generate-32-char-secret
BETTER_AUTH_URL=http://localhost:3000

# Logging
LOG_LEVEL=info
ELASTICSEARCH_NODE=http://elasticsearch:9200
```

## Testing Strategy

### Build Tests
1. **Image Size**: `docker images` → verify < 200MB
2. **Vulnerability Scan**: `trivy image` → no critical/high
3. **Multi-arch**: `docker buildx` → builds for amd64/arm64

### Runtime Tests
1. **Dev Stack**: `docker compose -f compose.yaml -f compose.dev.yaml up` → all healthy
2. **Prod Stack**: `docker compose -f compose.yaml -f compose.prod.yaml up` → all healthy
3. **App Health**: `curl localhost:3000/health` → 200
4. **DB Connectivity**: `prisma db push` works
5. **ES Connectivity**: Logs appear in Kibana
6. **Hot Reload**: Edit file → app restarts

### Security Tests
1. **Non-root**: `docker exec whoami` → node (UID 1000)
2. **Read-only**: `docker exec touch /test` → permission denied
3. **Capabilities**: `docker exec capsh --print` → no caps
4. **Secrets**: No secrets in image layers (`docker history`)

## File Structure Impact

```
.
├── Dockerfile
├── .dockerignore
├── compose.yaml
├── compose.dev.yaml
├── compose.prod.yaml
├── compose.logging.yaml
├── .env.example
├── logstash/
│   └── pipeline/
│       └── logstash.conf
├── kibana/
│   └── dashboards/
└── scripts/
    └── es-index-template.js
```

## Migration Considerations

- Prisma: `prisma generate` in build stage, `prisma migrate deploy` in entrypoint or separate init container
- JSON MVP: No database service needed for pure JSON mode (optional profile)
- Health checks: Use `/health/live` for liveness, `/health/ready` for readiness

## Rollback Plan

If Docker issues:
1. Run directly with Node.js: `npm run dev` / `npm start`
2. Use local PostgreSQL/Elasticsearch
3. Estimated effort: 0 (Docker is optional for development)