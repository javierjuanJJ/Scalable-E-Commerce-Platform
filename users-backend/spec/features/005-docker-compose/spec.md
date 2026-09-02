# Feature Specification: Docker & Docker Compose

## Overview

**Feature ID**: 005-docker-compose  
**Title**: Containerization and Orchestration  
**Status**: Draft  
**Priority**: P1 (High)

## Proposal Reference

See `spec/constitution/mission.md` - Core Principle: Cloud-Native

## Requirements

### ADDED Requirements

#### Requirement: Multi-Stage Dockerfile

**Description**: Optimized Docker image for Node.js application.

**Scenarios**:

##### Scenario: Build Stage
- **WHEN** Dockerfile builds
- **THEN** uses `node:22-alpine` base
- **AND** installs dependencies with `npm ci --only=production`
- **AND** copies only production files
- **AND** uses `npm run build` if TypeScript compilation needed

##### Scenario: Runtime Stage
- **WHEN** final image created
- **THEN** uses `node:22-alpine` base (or `gcr.io/distroless/nodejs22` for smaller)
- **AND** copies built artifacts from build stage
- **AND** creates non-root user `appuser`
- **AND** sets `USER appuser`
- **AND** exposes port 3000
- **AND** health check: `wget -qO- http://localhost:3000/health/live`
- **AND** entrypoint: `node backend/app.js`

##### Scenario: Image Size
- **WHEN** image built
- **THEN** final image size < 200MB
- **AND** vulnerability scan passes (no critical/high)

#### Requirement: Docker Compose Development Stack

**Description**: Full local development environment with all dependencies.

**Scenarios**:

##### Scenario: Application Service
- **WHEN** `docker compose up` runs
- **THEN** `app` service builds from Dockerfile
- **AND** mounts source code for hot reload (development)
- **AND** environment variables from `.env`
- **AND** ports: `3000:3000`
- **AND** depends_on: `db`, `elasticsearch`
- **AND** command: `npm run dev` (with tsx watch)

##### Scenario: PostgreSQL Database
- **WHEN** `docker compose up` runs
- **THEN** `db` service uses `postgres:16-alpine`
- **AND** environment: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- **AND** volume: `postgres_data:/var/lib/postgresql/data`
- **AND** port: `5432:5432` (for Prisma Studio)
- **AND** health check: `pg_isready`

##### Scenario: Elasticsearch
- **WHEN** `docker compose up` runs
- **THEN** `elasticsearch` service uses `docker.elastic.co/elasticsearch/elasticsearch:8.15.0`
- **AND** environment: `discovery.type=single-node`, `xpack.security.enabled=false`
- **AND** memory: `ES_JAVA_OPTS=-Xms512m -Xmx512m`
- **AND** volume: `es_data:/usr/share/elasticsearch/data`
- **AND** ports: `9200:9200`, `9300:9300`
- **AND** health check: `curl -f http://localhost:9200/_cluster/health`

##### Scenario: Kibana
- **WHEN** `docker compose up` runs
- **THEN** `kibana` service uses `docker.elastic.co/kibana/kibana:8.15.0`
- **AND** environment: `ELASTICSEARCH_HOSTS=http://elasticsearch:9200`
- **AND** port: `5601:5601`
- **AND** depends_on: `elasticsearch`
- **AND** health check: `curl -f http://localhost:5601/api/status`

##### Scenario: Logstash (Optional)
- **WHEN** `docker compose up` runs with profile `logging`
- **THEN** `logstash` service uses `docker.elastic.co/logstash/logstash:8.15.0`
- **AND** volume: `./logstash/pipeline:/usr/share/logstash/pipeline`
- **AND** port: `5044:5044`, `9600:9600`
- **AND** depends_on: `elasticsearch`

#### Requirement: Docker Compose Override Files

**Description**: Environment-specific configurations.

**Scenarios**:

##### Scenario: Development Override
- **WHEN** `docker compose -f compose.yaml -f compose.dev.yaml up` runs
- **THEN** `app` service: mounts source code, uses `npm run dev`, enables debug port
- **AND** `db`: no persistence volume (ephemeral)
- **AND** `elasticsearch`: single-node, no security

##### Scenario: Production Override
- **WHEN** `docker compose -f compose.yaml -f compose.prod.yaml up` runs
- **THEN** `app` service: no source mount, uses `npm start`, read-only root filesystem
- **AND** `db`: persistent volume, backup sidecar
- **AND** `elasticsearch`: security enabled, certificates
- **AND** resource limits: CPU, memory

#### Requirement: Build Optimization

**Description**: Fast, reproducible builds.

**Scenarios**:

##### Scenario: Layer Caching
- **WHEN** Dockerfile builds
- **THEN** `package.json` and `package-lock.json` copied first
- **AND** `npm ci` runs before copying source
- **AND** source copied last for optimal cache invalidation

##### Scenario: Multi-Architecture
- **WHEN** building for production
- **THEN** supports `linux/amd64` and `linux/arm64`
- **AND** uses `docker buildx` for multi-arch builds

#### Requirement: Security Hardening

**Description**: Container security best practices.

**Scenarios**:

##### Scenario: Non-Root User
- **WHEN** container runs
- **THEN** process runs as UID 1000 (non-root)
- **AND** filesystem read-only where possible
- **AND** dropped capabilities: `ALL`
- **AND** security options: `no-new-privileges:true`

##### Scenario: Secrets Management
- **WHEN** application needs secrets
- **THEN** uses Docker secrets or environment variables
- **AND** no secrets in image layers
- **AND** `.dockerignore` excludes `.env`, `.git`, `node_modules`

### MODIFIED Requirements

- **Feature 004-centralized-logging**: ELK stack now runs in Docker Compose
- **Feature 001-registration/002-authentication/003-profile-management**: Run in containerized environment

### REMOVED Requirements

None

## Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-001 | `docker build` produces image < 200MB | `docker images` |
| AC-002 | `docker compose up` starts all services healthy | `docker compose ps` |
| AC-003 | Application accessible at `localhost:3000` | Browser/curl |
| AC-004 | Database accessible at `localhost:5432` | `psql` / Prisma Studio |
| AC-005 | Elasticsearch accessible at `localhost:9200` | `curl localhost:9200` |
| AC-006 | Kibana accessible at `localhost:5601` | Browser |
| AC-007 | Hot reload works in development | Edit file, see restart |
| AC-008 | Health checks pass for all services | `docker compose ps` shows healthy |
| AC-009 | Non-root user in production image | `docker exec whoami` |
| AC-010 | No critical vulnerabilities in scan | `docker scout` / `trivy` |

## Dependencies

- **Docker**: 24.x
- **Docker Compose**: 2.x
- **Node.js**: 22 (base image)
- **PostgreSQL**: 16 (db service)
- **Elasticsearch/Kibana/Logstash**: 8.15.0

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Container startup < 10 seconds |
| Performance | Hot reload latency < 2 seconds |
| Security | No critical/high vulnerabilities |
| Security | Image signed (cosign) for production |
| Reproducibility | Deterministic builds (fixed base image digests) |
| Developer Experience | Single command to start full stack |

## Open Questions

1. Distroless vs Alpine for runtime image?
2. Kubernetes manifests needed (Helm chart)?
3. Docker BuildKit features (cache mounts, secret mounts)?
4. Production database backup sidecar?