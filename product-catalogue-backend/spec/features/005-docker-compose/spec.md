# Spec: Docker & Docker Compose

## Feature Overview
**Feature ID**: 005
**Name**: Docker & Docker Compose
**Description**: Containerize the microservice with multi-stage builds, development/production parity, and orchestration

## User Stories

### US-001: Multi-Stage Dockerfile
**As a** developer  
**I want** a optimized Dockerfile  
**So that** images are small and secure

**Acceptance Criteria**:
- Stage 1: Builder (Node 22, install deps, build TypeScript)
- Stage 2: Runtime (Node 22 Alpine, copy dist, non-root user)
- Stage 3: Development (Node 22, hot reload, dev deps)
- Final image < 200MB
- No dev dependencies in production image
- Non-root user (nodejs:1000)

### US-002: Docker Compose for Development
**As a** developer  
**I want** a single command to start full stack  
**So that** I can develop locally with all dependencies

**Acceptance Criteria**:
- `docker compose up -d` starts: product-catalogue, postgres, redis, logstash, elasticsearch, kibana
- Hot reload via volume mount (source code)
- Environment variables from `.env` file
- Ports: 3000 (app), 5432 (postgres), 6379 (redis), 5601 (kibana), 9200 (es)
- Health checks for all services
- `docker compose logs -f` shows all logs

### US-003: Docker Compose for Production
**As an** operator  
**I want** production-ready compose file  
**So that** I can deploy with confidence

**Acceptance Criteria**:
- Separate `docker-compose.prod.yml`
- No volume mounts (immutable)
- Resource limits (CPU, memory)
- Restart policies: unless-stopped
- Secrets via Docker secrets (not env files)
- Reverse proxy (nginx/traefik) with TLS
- Log drivers configured for ELK
- Health checks with proper intervals

### US-004: Build & Push Pipeline
**As a** developer  
**I want** automated image building  
**So that** CI/CD is streamlined

**Acceptance Criteria**:
- GitHub Actions workflow: build, test, push
- Multi-platform: linux/amd64, linux/arm64
- Tag strategy: `sha-<short>`, `branch-<name>`, `v<version>`
- SBOM generation (Syft)
- Vulnerability scan (Trivy)
- Push to GHCR/Docker Hub

### US-005: Database Migrations in Container
**As a** developer  
**I want** migrations to run automatically  
**So that** schema is always current

**Acceptance Criteria**:
- Init container runs `prisma migrate deploy`
- Waits for PostgreSQL readiness
- Fails deployment if migration fails
- Idempotent (safe to re-run)

### US-006: Development Debugging
**As a** developer  
**I want** to debug in container  
**So that** I don't need local Node.js

**Acceptance Criteria**:
- Debug port 9229 exposed in dev
- VS Code launch config for attach
- Source maps work in container
- `npm run test` works in container

## Technical Specification

### Dockerfile (Multi-Stage)

```dockerfile
# docker/Dockerfile
# ---- Base Stage ----
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm/bin:$PATH"
RUN corepack enable pnpm

# ---- Builder Stage ----
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# ---- Production Stage ----
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1000 -S nodejs && \
    adduser -S nodejs -u 1000 -G nodejs
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/app.js"]

# ---- Development Stage ----
FROM base AS development
WORKDIR /app
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 3000 9229
CMD ["pnpm", "run", "dev"]
```

### Docker Compose Development

```yaml
# docker-compose.yml
version: '3.8'
services:
  product-catalogue:
    build:
      context: .
      dockerfile: docker/Dockerfile
      target: development
    ports:
      - "3000:3000"
      - "9229:9229"
    volumes:
      - .:/app
      - /app/node_modules
      - /app/dist
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/catalog?schema=public
      - REDIS_URL=redis://redis:6379
      - LOGSTASH_HOST=logstash
      - LOGSTASH_PORT=5044
      - LOGSTASH_TLS=false
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      logstash:
        condition: service_healthy
    networks:
      - catalog-network
    command: pnpm run dev

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=catalog
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - catalog-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - catalog-network

  # ELK Stack (from feature 004)
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - catalog-network

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./docker/elk/pipeline:/usr/share/logstash/pipeline:ro
    ports:
      - "5044:5044"
      - "9600:9600"
    environment:
      - LS_JAVA_OPTS=-Xms256m -Xmx256m
    depends_on:
      elasticsearch:
        condition: service_healthy
    networks:
      - catalog-network

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      elasticsearch:
        condition: service_healthy
    networks:
      - catalog-network

volumes:
  postgres_data:
  redis_data:
  elasticsearch_data:

networks:
  catalog-network:
    driver: bridge
```

### Docker Compose Production

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  product-catalogue:
    build:
      context: .
      dockerfile: docker/Dockerfile
      target: production
    image: ghcr.io/org/product-catalogue:${VERSION:-latest}
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
      restart_policy:
        condition: unless-stopped
        delay: 5s
        max_attempts: 3
    environment:
      - NODE_ENV=production
      - DATABASE_URL_FILE=/run/secrets/database_url
      - REDIS_URL_FILE=/run/secrets/redis_url
      - LOGSTASH_HOST=logstash
      - LOGSTASH_PORT=5044
      - LOGSTASH_TLS=true
    secrets:
      - database_url
      - redis_url
    logging:
      driver: syslog
      options:
        syslog-address: "tcp://logstash:5044"
        tag: "product-catalogue"
    networks:
      - catalog-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      start_period: 10s
      retries: 3

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER_FILE=/run/secrets/postgres_user
      - POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password
      - POSTGRES_DB=catalog
    volumes:
      - postgres_data:/var/lib/postgresql/data
    secrets:
      - postgres_user
      - postgres_password
    deploy:
      resources:
        limits:
          memory: 1G
    networks:
      - catalog-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          memory: 256M
    networks:
      - catalog-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - product-catalogue
    networks:
      - catalog-network

secrets:
  database_url:
    external: true
  redis_url:
    external: true
  postgres_user:
    external: true
  postgres_password:
    external: true

volumes:
  postgres_data:
  redis_data:

networks:
  catalog-network:
    driver: bridge
```

### GitHub Actions Workflow

```yaml
# .github/workflows/docker.yml
name: Docker Build & Push
on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/product-catalogue
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix=
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile
          target: production
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64
          sbom: true
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/${{ github.repository }}/product-catalogue:${{ steps.meta.outputs.tags }}
          format: sarif
          output: trivy-results.sarif
      
      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: trivy-results.sarif
```

## Implementation Steps

1. **Dockerfile**: Multi-stage (base, builder, production, development)
2. **docker-compose.yml**: Full dev stack with hot reload
3. **docker-compose.prod.yml**: Production with secrets, limits, nginx
4. **.dockerignore**: Exclude node_modules, dist, .git, tests, docs
5. **nginx config**: Reverse proxy, TLS, rate limiting
6. **GitHub Actions**: Build, test, scan, push multi-platform
7. **Prisma migration**: Init container for deploy
8. **VS Code debug**: Launch config for container attach
9. **Documentation**: Usage, troubleshooting, production checklist

## File Structure
```
docker/
├── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
├── .dockerignore
├── nginx/
│   ├── nginx.conf
│   └── certs/
│       ├── cert.pem
│       └── key.pem
├── elk/
│   ├── docker-compose.yml
│   ├── pipeline/
│   └── certs/
└── scripts/
    ├── wait-for-db.sh
    └── run-migrations.sh

.github/
└── workflows/
    └── docker.yml

.vscode/
└── launch.json
```

## Non-Functional Requirements

- **Image Size**: Production < 200MB
- **Build Time**: < 3 minutes (with cache)
- **Startup Time**: < 10 seconds (production)
- **Security**: Non-root, no secrets in image, minimal attack surface
- **Compliance**: SBOM, vulnerability scan, signed images

## Dependencies
- **004-centralized-logging**: ELK stack in compose
- **006-develop-microservices**: Service runs in container

## Out of Scope
- Kubernetes manifests (Helm charts separate)
- Service mesh (Istio/Linkerd)
- Advanced deployment strategies (blue-green, canary)
- Image signing (cosign/notary)