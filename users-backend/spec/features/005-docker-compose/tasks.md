# Tasks: Docker & Docker Compose

## Overview

**Feature**: 005-docker-compose  
**Depends On**: 001-registration, 002-authentication, 003-profile-management, 004-centralized-logging

## Task Breakdown

### 1. Dockerfile

- [ ] 1.1 Create multi-stage Dockerfile
  - Stage 1 (base): node:22-alpine, copy package files, npm ci --production
  - Stage 2 (builder): install all deps, copy source, npm run build
  - Stage 3 (runner): node:22-alpine, copy from base/builder, non-root user, healthcheck
  - **Verification**: `docker build -t user-service .` succeeds

- [ ] 1.2 Optimize Dockerfile layers
  - Copy package.json + package-lock.json first
  - Use cache mount for npm: `RUN --mount=type=cache,target=/root/.npm npm ci`
  - Copy source last
  - **Verification**: Rebuild after source change only re-runs builder stage

- [ ] 1.3 Configure non-root user
  - Create user/group in runner stage: `RUN addgroup -g 1000 -S appgroup && adduser -u 1000 -S appuser -G appgroup`
  - `USER appuser`
  - Verify file permissions for copied files
  - **Verification**: `docker exec whoami` returns `appuser`

- [ ] 1.4 Add health check
  - `HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://localhost:3000/health/live || exit 1`
  - **Verification**: `docker inspect` shows health check config

- [ ] 1.5 Security hardening (production)
  - Read-only root filesystem: `read_only: true` in compose
  - Drop all capabilities: `cap_drop: - ALL`
  - No new privileges: `security_opt: - no-new-privileges:true`
  - **Verification**: Runtime checks pass

### 2. .dockerignore

- [ ] 2.1 Create .dockerignore
  - Exclude: .git, .env*, node_modules, dist, coverage, logs, IDE files, docs
  - Keep: source files, package.json, Dockerfile, compose files
  - **Verification**: `docker build` context size minimal

### 3. Base Docker Compose (compose.yaml)

- [ ] 3.1 Create base compose.yaml
  - Services: app, db (postgres:16-alpine), elasticsearch, kibana
  - Shared networks, volumes
  - Health checks with conditions
  - Environment variable substitution
  - **Verification**: `docker compose config` validates

- [ ] 3.2 Configure app service
  - Build from Dockerfile
  - Environment variables for DB, ES, auth
  - Ports: 3000:3000
  - Depends on db, elasticsearch with health conditions
  - **Verification**: App starts, connects to deps

- [ ] 3.3 Configure database service
  - Image: postgres:16-alpine
  - Environment: POSTGRES_DB, USER, PASSWORD
  - Volume: postgres_data
  - Port: 5432:5432
  - Health check: pg_isready
  - **Verification**: DB accepts connections

- [ ] 3.4 Configure Elasticsearch service
  - Image: docker.elastic.co/elasticsearch/elasticsearch:8.15.0
  - Environment: single-node, security disabled (dev)
  - Memory: ES_JAVA_OPTS=-Xms512m -Xmx512m
  - Volume: es_data
  - Ports: 9200, 9300
  - Health check: cluster health
  - **Verification**: ES responds to API calls

- [ ] 3.5 Configure Kibana service
  - Image: docker.elastic.co/kibana/kibana:8.15.0
  - Environment: ELASTICSEARCH_HOSTS
  - Port: 5601:5601
  - Depends on elasticsearch (healthy)
  - Health check: API status
  - **Verification**: Kibana UI accessible

### 4. Development Override (compose.dev.yaml)

- [ ] 4.1 Create compose.dev.yaml
  - App: target=builder, command=npm run dev
  - Volumes: source mount + anonymous node_modules
  - Environment: NODE_ENV=development, LOG_PRETTY=true
  - Ports: 3000, 9229 (debug)
  - DB: tmpfs or no volume for ephemeral
  - **Verification**: `docker compose -f compose.yaml -f compose.dev.yaml up` works

- [ ] 4.2 Test hot reload
  - Edit source file
  - Verify tsx restarts app
  - **Verification**: Changes reflected without rebuild

### 5. Production Override (compose.prod.yaml)

- [ ] 5.1 Create compose.prod.yaml
  - App: target=runner, read_only, security options, resource limits
  - DB: persistent volume, resource limits
  - ES: security enabled, resource limits
  - Logging: json-file with rotation
  - **Verification**: `docker compose -f compose.yaml -f compose.prod.yaml up` works

### 6. Logging Profile (compose.logging.yaml)

- [ ] 6.1 Create compose.logging.yaml
  - Logstash service (profile: logging)
  - Volume: ./logstash/pipeline:/usr/share/logstash/pipeline
  - Ports: 5044, 9600
  - Depends on elasticsearch
  - **Verification**: `docker compose --profile logging up` starts Logstash

### 7. Build & CI

- [ ] 7.1 Test image size
  - `docker images user-service` → verify < 200MB
  - **Verification**: Size target met

- [ ] 7.2 Vulnerability scan
  - `trivy image user-service` or `docker scout cves user-service`
  - No critical/high vulnerabilities
  - **Verification**: Scan passes

- [ ] 7.3 Multi-arch build (optional)
  - `docker buildx build --platform linux/amd64,linux/arm64 -t user-service .`
  - **Verification**: Manifest list created

### 8. Integration Tests

- [ ] 8.1 Full dev stack test
  - `docker compose -f compose.yaml -f compose.dev.yaml up -d`
  - Wait for all healthy
  - `curl localhost:3000/health` → 200
  - `curl localhost:3000/api/v1/auth/register` → works
  - Logs in Kibana
  - **Verification**: All services functional

- [ ] 8.2 Full prod stack test
  - `docker compose -f compose.yaml -f compose.prod.yaml up -d`
  - Wait for all healthy
  - Health checks pass
  - Security options active
  - **Verification**: Production stack functional

- [ ] 8.3 Prisma migration in container
  - Run `docker compose exec app npx prisma migrate deploy`
  - **Verification**: Migrations applied

### 9. Documentation

- [ ] 9.1 Create .env.example
  - All required variables with descriptions
  - **Verification**: Team can copy and run

- [ ] 9.2 Document Docker commands in AGENTS.md
  - Dev: `docker compose -f compose.yaml -f compose.dev.yaml up`
  - Prod: `docker compose -f compose.yaml -f compose.prod.yaml up -d`
  - Logs: `docker compose logs -f`
  - **Verification**: Commands work

- [ ] 9.3 Create Docker troubleshooting guide
  - Port conflicts, volume permissions, health check failures
  - **Verification**: Guide exists

## Progress Tracking

| Task Group | Status | Completed | Total |
|------------|--------|-----------|-------|
| Dockerfile | Pending | 0 | 5 |
| .dockerignore | Pending | 0 | 1 |
| Base Compose | Pending | 0 | 5 |
| Dev Override | Pending | 0 | 2 |
| Prod Override | Pending | 0 | 1 |
| Logging Profile | Pending | 0 | 1 |
| Build & CI | Pending | 0 | 3 |
| Integration Tests | Pending | 0 | 3 |
| Documentation | Pending | 0 | 3 |
| **Total** | | **0** | **24** |

## Notes

- ELK stack (ES, Kibana, Logstash) defined in base compose, enabled by default
- Development uses builder stage for hot reload; production uses runner stage
- Health checks critical for service dependencies
- .env.example must have all variables; actual .env not committed
- Prisma: generate in build, migrate in entrypoint or separate init container
- For pure JSON MVP, can run without db/elasticsearch services (optional profiles)