# Plan: Docker & Docker Compose

## Technical Approach

### Multi-Stage Dockerfile Strategy
**Base Stage**: Node 22 Alpine + pnpm + dumb-init
- Small base image (~40MB)
- pnpm for fast, disk-efficient installs
- dumb-init for proper signal handling

**Builder Stage**: Install all deps, build TypeScript
- Copy package.json + lockfile first (cache layer)
- pnpm install --frozen-lockfile (reproducible)
- Copy source, run build
- Output: dist/, node_modules/

**Production Stage**: Minimal runtime
- Copy only dist/, node_modules/, package.json, prisma/
- Non-root user (nodejs:1000)
- Health check endpoint
- dumb-init entrypoint
- No build tools, no source code

**Development Stage**: Full environment
- All deps including devDependencies
- Volume mount for hot reload
- Expose debug port 9229
- tsx watch mode

### Docker Compose Development
- All services in single file
- Health checks with `condition: service_healthy`
- Volume mounts for live reload
- Anonymous volumes for node_modules/dist (prevent host pollution)
- Environment from .env file
- Shared network for service discovery

### Docker Compose Production
- Separate file (override pattern)
- Production target only
- Resource limits (CPU, memory)
- Docker secrets for sensitive config
- Nginx reverse proxy with TLS
- Syslog logging driver → Logstash
- Restart policies
- Pinned image tags (not latest)

### Database Migrations
- Init container pattern: separate service runs migrations
- `prisma migrate deploy` (production safe)
- Wait for PostgreSQL with health check
- Fail fast if migration fails
- Idempotent - safe to re-run

### CI/CD Pipeline
- Docker Buildx for multi-platform
- GitHub Actions with cache (GHA cache backend)
- Metadata action for tags/labels
- Trivy vulnerability scan (SARIF upload)
- SBOM generation
- Push on merge to main, tags; build only on PR

## Implementation Steps

1. **Dockerfile** - Multi-stage with 4 targets
2. **.dockerignore** - Exclude unnecessary files
3. **docker-compose.yml** - Development stack
4. **docker-compose.prod.yml** - Production stack
5. **nginx.conf** - Reverse proxy config
6. **wait-for-db.sh** - Migration waiter script
7. **run-migrations.sh** - Prisma migration runner
8. **GitHub Actions workflow** - Build, test, scan, push
9. **VS Code launch.json** - Container debugging
10. **Documentation** - Usage guides

## Configuration

### Environment Variables (Development)
```env
# .env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/catalog?schema=public
REDIS_URL=redis://redis:6379
LOGSTASH_HOST=logstash
LOGSTASH_PORT=5044
LOGSTASH_TLS=false
PORT=3000
```

### Environment Variables (Production)
```env
# .env.prod (not committed, injected via secrets)
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@postgres:5432/catalog
REDIS_URL=redis://:pass@redis:6379
LOGSTASH_HOST=logstash
LOGSTASH_PORT=5044
LOGSTASH_TLS=true
PORT=3000
APP_VERSION=1.0.0
```

### Secrets (Production)
- `database_url` - Full PostgreSQL connection string
- `redis_url` - Redis connection with password
- `postgres_user` - Database username
- `postgres_password` - Database password

## Testing Strategy

### Build Tests
- `docker build --target production` succeeds
- Image size < 200MB
- Non-root user verification
- Health check works

### Runtime Tests
- `docker compose up -d` - all services healthy
- Hot reload works (edit file, see restart)
- Debugger attaches on port 9229
- Tests run in container: `docker compose exec app pnpm test`

### Integration Tests
- Full stack startup order
- Database migrations apply
- Logging reaches Logstash
- Kibana accessible
- Nginx proxies requests

### Security Tests
- Trivy scan: no HIGH/CRITICAL vulnerabilities
- Non-root user in production image
- No secrets in image layers
- Read-only root filesystem (optional)

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
├── scripts/
│   ├── wait-for-db.sh
│   └── run-migrations.sh
└── elk/
    ├── docker-compose.yml
    ├── pipeline/
    └── certs/

.github/
└── workflows/
    └── docker.yml

.vscode/
└── launch.json
```

## Migration Path

### From Local Development to Container
1. Install Docker Desktop
2. Clone repo
3. `cp .env.example .env`
4. `docker compose up -d`
5. Access: http://localhost:3000, http://localhost:5601

### From Development to Production
1. Build production image: `docker build --target production -t app .`
2. Create secrets in Docker Swarm/K8s
3. Deploy with `docker stack deploy -c docker-compose.prod.yml`
4. Configure DNS → Nginx
5. Verify health checks

## Definition of Done
- [ ] Dockerfile builds all 4 targets
- [ ] Dev compose starts full stack in < 2 min
- [ ] Hot reload works
- [ ] Debugger attaches
- [ ] Production compose deploys
- [ ] Resource limits enforced
- [ ] Secrets used (no env vars for secrets)
- [ ] CI/CD builds multi-platform images
- [ ] Trivy scan passes
- [ ] SBOM generated
- [ ] Documentation complete