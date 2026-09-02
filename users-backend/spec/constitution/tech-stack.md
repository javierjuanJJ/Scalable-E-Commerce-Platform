# Tech Stack

## Runtime & Framework

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| Runtime | Node.js | 22 LTS | Latest LTS with native test runner, improved performance |
| Web Framework | Express | 5.x | Minimal, unopinionated, mature ecosystem |
| Language | TypeScript | 5.x | Type safety, better developer experience |

## Database

| Phase | Technology | Configuration |
|-------|------------|---------------|
| MVP | JSON File Storage | `data/users.json` with atomic writes |
| Production | PostgreSQL | 16+ via Prisma ORM |
| ORM | Prisma | 7.10.0 with `@prisma/adapter-pg` |
| Migration Strategy | Prisma Migrate | Schema-first, versioned migrations |

### Prisma Schema Preview

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  name          String?
  avatarUrl     String?
  emailVerified Boolean  @default(false)
  role          Role     @default(USER)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  sessions      Session[]
  accounts      Account[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  providerId        String
  providerAccountId String
  @@unique([providerId, providerAccountId])
}

enum Role {
  USER
  ADMIN
}
```

## Authentication

| Library | Version | Features Used |
|---------|---------|---------------|
| Better Auth | 1.6.x | Email/password, session management, JWT, email verification |

### Configuration Highlights

- `emailAndPassword.enabled: true`
- `requireEmailVerification: true` (production)
- `minPasswordLength: 8`
- `maxPasswordLength: 128`
- Custom password hashing via Argon2id (via Better Auth plugin)
- Secure cookie settings: `httpOnly`, `secure`, `sameSite: 'lax'`

## Validation

| Library | Version | Usage |
|---------|---------|-------|
| Zod | 3.x | Request body, query params, response schemas |

### Schema Organization

```
schemas/
├── user.js        # User create/update/response schemas
├── auth.js        # Login/register schemas
└── common.js      # Pagination, filters, error responses
```

## Testing

| Tool | Purpose |
|------|---------|
| `node:test` | Test runner (native, no config needed) |
| `node:assert` | Assertions (native) |
| Supertest | HTTP integration testing |

### Test Structure

```
backend/
├── app.test.js           # Integration tests (full HTTP server)
├── test/
│   ├── fixtures/         # Test data factories
│   ├── helpers/          # Test utilities
│   └── unit/             # Pure function tests (if needed)
```

## Logging & Observability

| Component | Technology | Configuration |
|-----------|------------|---------------|
| Logger | Pino | Structured JSON, level-based |
| Transport | pino-elasticsearch | Bulk insert, flush interval 30s |
| Elasticsearch | 8.x | Single-node dev, cluster prod |
| Logstash | 8.x | Optional: pipeline processing |
| Kibana | 8.x | Visualization, dashboards |

### Log Structure

```json
{
  "level": 30,
  "time": 1699999999999,
  "pid": 1234,
  "hostname": "container-id",
  "service": "user-service",
  "traceId": "abc-123",
  "spanId": "def-456",
  "msg": "User registered",
  "userId": "user_123",
  "email": "user@example.com"
}
```

## Containerization

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | 24.x | Container runtime |
| Docker Compose | 2.x | Local orchestration |

### Docker Compose Services (Development)

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:pass@db:5432/users
      - ELASTICSEARCH_NODE=http://elasticsearch:9200
    depends_on:
      - db
      - elasticsearch
  
  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=users
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
  
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.15.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - es_data:/usr/share/elasticsearch/data
  
  kibana:
    image: docker.elastic.co/kibana/kibana:8.15.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch
  
  logstash:
    image: docker.elastic.co/logstash/logstash:8.15.0
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
    ports:
      - "5044:5044"
    depends_on:
      - elasticsearch

volumes:
  postgres_data:
  es_data:
```

## Development Tools

| Tool | Purpose |
|------|---------|
| ESLint | Code linting (Airbnb/Standard) |
| Prettier | Code formatting |
| Husky | Git hooks |
| lint-staged | Pre-commit formatting |
| TypeScript | Static type checking |

## CI/CD Considerations

- GitHub Actions for CI
- Docker Hub / GHCR for image registry
- Prisma Migrate in CI for schema validation
- Security scanning: `npm audit`, `docker scout`