# Tasks: Docker & Docker Compose

## Phase 1: Dockerfile & Build

- [ ] **T001** Create multi-stage Dockerfile (`docker/Dockerfile`)
  - Base stage: node:22-alpine, pnpm, dumb-init
  - Builder stage: install deps, build TypeScript
  - Production stage: copy dist/node_modules, non-root user, healthcheck
  - Development stage: all deps, volume-ready, debug port

- [ ] **T002** Create .dockerignore (`docker/.dockerignore`)
  - Exclude: node_modules, dist, .git, .github, tests, docs, *.md, .env*, docker/, .vscode/

- [ ] **T003** Test Dockerfile builds
  - `docker build --target production -t catalog:test .`
  - Verify image size < 200MB
  - Verify non-root user: `docker run --rm catalog:test whoami`
  - Verify healthcheck: `docker run --rm catalog:test node -e "..."`

- [ ] **T004** Create wait-for-db script (`docker/scripts/wait-for-db.sh`)
  - Wait for PostgreSQL TCP port
  - Timeout after 60s
  - Exit codes for compose healthcheck

- [ ] **T005** Create migration runner (`docker/scripts/run-migrations.sh`)
  - Run `pnpm prisma migrate deploy`
  - Handle failures gracefully
  - Log output

## Phase 2: Development Docker Compose

- [ ] **T006** Create docker-compose.yml (`docker-compose.yml`)
  - product-catalogue (target: development)
  - postgres:16-alpine with healthcheck
  - redis:7-alpine with healthcheck
  - ELK stack (elasticsearch, logstash, kibana)
  - Volumes for hot reload + anonymous volumes for node_modules/dist
  - Networks: catalog-network
  - Environment from .env file

- [ ] **T007** Create .env.example (`.env.example`)
  - All required variables with development defaults
  - Database, Redis, Logstash, App config

- [ ] **T008** Test development stack
  - `docker compose up -d`
  - Verify all services healthy: `docker compose ps`
  - Verify app: `curl localhost:3000/health`
  - Verify hot reload: edit file, see restart in logs
  - Verify debugger: attach VS Code to port 9229

- [ ] **T009** Test database migrations
  - `docker compose exec product-catalogue pnpm prisma migrate dev`
  - Verify tables created
  - Verify seed data (if any)

- [ ] **T010** Test logging integration
  - Make API requests
  - Verify logs in Kibana (http://localhost:5601)
  - Verify ECS format

## Phase 3: Production Docker Compose

- [ ] **T011** Create docker-compose.prod.yml (`docker-compose.prod.yml`)
  - product-catalogue (target: production, pinned image)
  - postgres with resource limits, secrets
  - redis with password, resource limits
  - nginx reverse proxy with TLS
  - Secrets: database_url, redis_url, postgres_user, postgres_password
  - Logging driver: syslog → logstash
  - Restart policies
  - Healthchecks

- [ ] **T012** Create nginx config (`docker/nginx/nginx.conf`)
  - Upstream product-catalogue
  - TLS termination (cert/key from volume)
  - Rate limiting (100 req/s burst 200)
  - Proxy headers (X-Forwarded-For, X-Real-IP)
  - Health check endpoint passthrough
  - Gzip compression

- [ ] **T013** Generate TLS certificates (`docker/nginx/certs/`)
  - Self-signed for local testing
  - Document Let's Encrypt for production

- [ ] **T014** Test production stack locally
  - Create dummy secrets: `echo "postgresql://..." | docker secret create database_url -`
  - `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`
  - Verify via https://localhost
  - Verify resource limits: `docker stats`
  - Verify logs via syslog driver

## Phase 4: CI/CD Pipeline

- [ ] **T015** Create GitHub Actions workflow (`.github/workflows/docker.yml`)
  - Trigger: push to main/develop, tags v*, PR to main
  - Setup Buildx
  - Login to GHCR
  - Extract metadata (tags, labels)
  - Build & push multi-platform (amd64, arm64)
  - Cache with GHA backend
  - SBOM generation
  - Trivy vulnerability scan (SARIF)
  - Upload SARIF to GitHub Security

- [ ] **T016** Configure GHCR permissions
  - Package write permission for workflow
  - Public/private visibility setting

- [ ] **T017** Test CI pipeline
  - Push to feature branch → build only
  - Push to main → build + push
  - Tag v1.0.0 → build + push with semver tags
  - Verify images on GHCR
  - Verify Trivy results in Security tab

## Phase 5: VS Code Integration

- [ ] **T018** Create launch.json (`.vscode/launch.json`)
  - Attach to Node.js in container (port 9229)
  - Source map support
  - Auto-attach on start
  - Restart debug session on hot reload

- [ ] **T019** Test debugging
  - `docker compose up -d`
  - F5 in VS Code
  - Set breakpoint, hit it
  - Inspect variables, step through

## Phase 6: Database Migration Automation

- [ ] **T020** Add migration service to docker-compose.prod.yml
  - Service: migrate
  - Image: same as app (production target)
  - Command: run-migrations.sh
  - Depends on postgres healthy
  - Restart: on-failure
  - Profile: migration (not auto-start)

- [ ] **T021** Test migration deployment
  - `docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile migration up migrate`
  - Verify migrations applied
  - Verify app starts after

## Phase 7: Security Hardening

- [ ] **T022** Add Trivy scan to local workflow
  - `trivy image --severity HIGH,CRITICAL catalog:test`
  - Fail build on critical vulns

- [ ] **T023** Verify production image security
  - `docker run --rm catalog:test id` → uid=1000(nodejs)
  - `docker run --rm catalog:test ls -la /app` → owned by nodejs
  - No .env files in image: `docker history catalog:test`
  - Read-only root fs test (optional)

- [ ] **T024** Generate SBOM locally
  - `docker sbom catalog:test`
  - Verify output format (SPDX/JSON)

## Phase 8: Documentation

- [ ] **T025** Create Docker guide (`docs/docker-guide.md`)
  - Quickstart (dev)
  - Production deployment
  - Debugging in container
  - Common commands reference
  - Troubleshooting

- [ ] **T026** Document environment variables
  - .env.example with descriptions
  - Production secrets list
  - Required vs optional

- [ ] **T027** Add to main README
  - One-command startup
  - Links to detailed guides

## Phase 9: Verification & Polish

- [ ] **T028** Full stack integration test
  - Fresh clone → `docker compose up -d` → all healthy
  - API works, DB works, Cache works, Logging works
  - Kibana dashboards show data

- [ ] **T029** Performance baseline
  - Cold start time (production image)
  - Memory usage at idle
  - Request latency in container

- [ ] **T030** Cleanup & optimize
  - Remove unused layers
  - Optimize layer caching order
  - Verify .dockerignore effectiveness

## Definition of Done
- [ ] All tasks completed
- [ ] Dev stack: `docker compose up -d` works in < 2 min
- [ ] Hot reload functional
- [ ] Debugger attaches
- [ ] Production stack deploys
- [ ] CI/CD builds multi-platform images
- [ ] Trivy: 0 CRITICAL, 0 HIGH
- [ ] SBOM generated
- [ ] Documentation complete
- [ ] Code review approved