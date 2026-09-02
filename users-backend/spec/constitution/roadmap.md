# Roadmap

## Phase 1: Foundation (Weeks 1-2) ✓ Current Focus

### Milestone: Core Auth & Spec Structure
- [x] OpenSpec constitution (mission, tech-stack, roadmap)
- [x] Feature specifications for all 6 features
- [ ] 001-registration: User registration endpoint
- [ ] 002-authentication: Login, session, JWT
- [ ] 003-profile-management: Profile CRUD
- [ ] JSON file storage implementation (MVP)
- [ ] Integration tests for auth flows

### Deliverables
- Working registration, login, profile endpoints
- Zod validation on all inputs
- Better Auth integration
- Native Node test suite passing
- AGENTS.md and spec/ structure complete

---

## Phase 2: Observability & Containerization (Weeks 3-4)

### Milestone: Production-Ready Infrastructure
- [ ] 004-centralized-logging: ELK stack integration
  - Pino + pino-elasticsearch transport
  - Elasticsearch index templates
  - Kibana dashboards (auth events, errors, latency)
  - Logstash pipeline for enrichment
- [ ] 005-docker-compose: Full local stack
  - Multi-service compose file
  - Health checks for all services
  - Development vs production compose overrides
  - Multi-stage Dockerfile (<200MB final image)

### Deliverables
- Logs searchable in Kibana within 5s
- `docker compose up` spins full stack
- Health endpoints responding
- Image size and startup time targets met

---

## Phase 3: Database Migration & MVP (Weeks 5-6)

### Milestone: PostgreSQL + Prisma + MVP Microservice
- [ ] 006-microservices-mvp: Prisma migration
  - Prisma schema finalized
  - Migration from JSON to PostgreSQL
  - Seed scripts for development
  - Connection pooling with `@prisma/adapter-pg`
- [ ] MVP microservice deployment ready
  - Graceful shutdown handling
  - Circuit breaker pattern (optional)
  - Rate limiting middleware
  - API versioning strategy

### Deliverables
- Zero-downtime migration path validated
- Prisma Studio accessible
- Production Docker image
- Load testing baseline (<200ms p95)

---

## Phase 4: Advanced Features (Weeks 7-10)

### Feature Backlog (Priority Order)

| Priority | Feature | Description |
|----------|---------|-------------|
| P0 | Email Verification | Better Auth email verification flow |
| P0 | Password Reset | Secure token-based reset |
| P1 | Social Login | Google, GitHub OAuth via Better Auth |
| P1 | Two-Factor Auth | TOTP via Better Auth plugin |
| P1 | Role-Based Access | Admin vs User permissions |
| P2 | Account Linking | Merge social + email accounts |
| P2 | Audit Logs | Immutable log of sensitive actions |
| P3 | Passkeys | WebAuthn support |
| P3 | Session Management | Device listing, revocation |

---

## Phase 5: Platform Integration (Weeks 11+)

### Cross-Cutting Concerns

- [ ] API Gateway integration (Kong, Traefik, or AWS API Gateway)
- [ ] Service mesh readiness (Istio/Linkerd sidecar)
- [ ] Distributed tracing (OpenTelemetry → Jaeger/Tempo)
- [ ] Metrics exposition (Prometheus format)
- [ ] Feature flags (LaunchDarkly or open-source)
- [ ] Multi-tenancy support
- [ ] GDPR/CCPA compliance tooling

---

## Release Cadence

| Release | Target | Scope |
|---------|--------|-------|
| v0.1.0 | Week 2 | Core auth (JSON MVP) |
| v0.2.0 | Week 4 | Observability + Docker |
| v0.3.0 | Week 6 | PostgreSQL + Prisma MVP |
| v1.0.0 | Week 10 | Advanced auth features |
| v1.x | Ongoing | Platform integration |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Prisma migration complexity | Medium | High | Early spike, thorough testing |
| ELK resource consumption | High | Medium | Dev: single-node, limited retention |
| Better Auth breaking changes | Low | High | Pin version, integration tests |
| Docker image size bloat | Medium | Low | Multi-stage, distroless base |
| JSON → PostgreSQL data loss | Low | Critical | Automated migration scripts, backup |