# AGENTS.md

This file defines the agent instructions for the User Service microservice development using Spec-Driven Development (SDD) with OpenSpec.

## Project Overview

**User Service**: Handles user registration, authentication, and profile management for a scalable e-commerce platform.

## Tech Stack

- **Language**: JavaScript/TypeScript with Node 22 + Express 5
- **Database**: JSON (MVP) → PostgreSQL with Prisma ORM
- **Testing**: Node native test runner (`node:test`, `node:assert`)
- **Validation**: Zod
- **Authentication**: Better Auth
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana) via pino-elasticsearch
- **Containerization**: Docker & Docker Compose

## Architecture

```
backend/
├── app.js                 # Express app, CORS, route imports
├── schemas/               # Zod schemas for validation
│   └── <entity>.js
├── models/                # Data access logic, filtering, pagination
│   └── <entity>.js
├── routes/                # Endpoint definitions, validation middlewares
│   └── <entity>.js
├── controllers/           # Request/response orchestration logic
│   └── <entity>.js
├── middlewares/
│   └── cors.js
└── app.test.js            # Integration tests with server startup
```

## Spec-Driven Development Workflow

Following OpenSpec methodology:
1. **Proposal** → Why and what (proposal.md)
2. **Specs** → Detailed requirements with ADDED/MODIFIED/REMOVED and WHEN/THEN scenarios (specs/)
3. **Design** → Technical decisions, risks, open questions (design.md)
4. **Tasks** → Implementation checklist (tasks.md)

## Constitution Files

Located in `spec/constitution/`:
- `mission.md` - Product mission and vision
- `tech-stack.md` - Detailed technology choices and rationale
- `roadmap.md` - Feature roadmap and milestones

## Features

Each feature in `spec/features/NNN-name/` contains:
- `spec.md` - Requirements specification
- `plan.md` - Implementation plan
- `tasks.md` - Task breakdown with verification

### Feature List

1. **001-registration** - User registration with email/password
2. **002-authentication** - Login, session management, JWT tokens
3. **003-profile-management** - User profile CRUD operations
4. **004-centralized-logging** - ELK stack integration for log aggregation
5. **005-docker-compose** - Containerization and orchestration
6. **006-microservices-mvp** - MVP microservice implementation

## Development Guidelines

- Follow OpenSpec artifact dependency graph: proposal → specs → design → tasks
- Use Zod for all input validation
- Use Better Auth for authentication flows
- Implement structured logging with pino + pino-elasticsearch
- Write integration tests using Node's native test runner
- Prepare Prisma schema for PostgreSQL migration from JSON MVP
- Use Docker multi-stage builds for production optimization

## Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev

# Build Docker image
docker build -t user-service .

# Start with Docker Compose
docker compose up -d
```