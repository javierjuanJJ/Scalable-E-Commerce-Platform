# AGENTS.md - Product Catalog Service

## Project Overview
Product Catalog Service: Manages product listings, categories, and inventory for a scalable e-commerce platform.

## Tech Stack
- **Language**: JavaScript/TypeScript with Node 22 + Express 5
- **Database**: JSON (MVP) → PostgreSQL with Prisma (structured for migration)
- **Tests**: Node native test runner (`node:test` and `node:assert`)
- **Validations**: Zod
- **Architecture**: Routes, Controllers, Models, Zod Schemas pattern (inside `backend/` folder)
- **Logging**: Centralized ELK Stack (Elasticsearch, Logstash, Kibana)
- **Containerization**: Docker & Docker Compose

## Project Structure
```
product-catalogue-backend/
├── AGENTS.md
├── spec/
│   ├── constitution/
│   │   └── constitution.md
│   └── features/
│       ├── 001-product-listings/
│       │   ├── spec.md
│       │   ├── plan.md
│       │   └── tasks.md
│       ├── 002-categories/
│       │   ├── spec.md
│       │   ├── plan.md
│       │   └── tasks.md
│       ├── 003-inventory/
│       │   ├── spec.md
│       │   ├── plan.md
│       │   └── tasks.md
│       ├── 004-centralized-logging/
│       │   ├── spec.md
│       │   ├── plan.md
│       │   └── tasks.md
│       ├── 005-docker-compose/
│       │   ├── spec.md
│       │   ├── plan.md
│       │   └── tasks.md
│       └── 006-develop-microservices/
│           ├── spec.md
│           ├── plan.md
│           └── tasks.md
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── app.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── docker-compose.prod.yml
└── README.md
```

## Constitution Rules
1. **Spec-First Development**: No code without approved spec
2. **Test-Driven**: Write tests before implementation
3. **Zod Validation**: All inputs validated with Zod schemas
4. **Structured Logging**: All logs follow ECS format for ELK
5. **Database Abstraction**: Models abstract JSON/PostgreSQL behind same interface
6. **Microservice Ready**: Each feature independently deployable
7. **Docker First**: All services containerized from day one

## Development Workflow
1. Read relevant spec in `spec/features/NNN-feature/`
2. Check `plan.md` for technical approach
3. Execute tasks from `tasks.md` in order
4. Run tests: `npm test`
5. Validate with Zod schemas
6. Build Docker image: `docker compose build`

## Key Conventions
- **API Versioning**: `/api/v1/` prefix
- **Error Format**: `{ error: { code, message, details } }`
- **Pagination**: `?page=1&limit=20` with `X-Total-Count` header
- **Logging**: Winston with ECS format, shipped to Logstash
- **Environment**: `.env` for local, Docker secrets for prod