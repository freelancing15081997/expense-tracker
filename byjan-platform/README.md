# Byjan Platform

Production-ready multi-tenant business management platform for Byjan Business.

## Architecture

### Monorepo Structure

```
byjan-platform/
├── apps/
│   ├── frontend/          # React 19 + Vite frontend
│   │   ├── src/
│   │   ├── public/
│   │   ├── wrangler.toml  # Cloudflare Pages config
│   │   └── package.json
│   │
│   └── backend/           # Python FastAPI backend
│       ├── app/
│       │   ├── main.py
│       │   ├── platform/  # Auth, RBAC, logging
│       │   ├── business/  # Business modules
│       │   ├── ca/        # CA practice
│       │   ├── console/   # Super-user console
│       │   └── shared/    # Shared kernel
│       ├── migrations/    # Alembic migrations
│       ├── tests/         # Comprehensive tests
│       ├── render.yaml    # Render deployment config
│       └── pyproject.toml
│
├── docs/                  # Planning documents
│   ├── COVERAGE.md        # API coverage checklist
│   ├── DECISIONS.md       # Architecture decisions
│   └── EVENTS.md          # Domain events catalog
│
└── docker-compose.yml     # Local development
```

## Technology Stack

### Backend
- **Framework**: FastAPI 0.128+
- **Language**: Python 3.12
- **Database**: PostgreSQL 16 (Neon free tier)
- **Cache**: Redis 7 (Redis Cloud free tier)
- **Workers**: Arq (Redis-based)
- **Auth**: Firebase + JWT (EdDSA)
- **File Storage**: Cloudflare R2 (S3-compatible)
- **Logging**: Structlog + JSON logging
- **Testing**: pytest + pytest-asyncio

### Frontend
- **Framework**: React 19 + Vite 6
- **UI**: shadcn/ui components
- **State**: React hooks + context
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts

### Infrastructure
- **Frontend Hosting**: Cloudflare Pages (unlimited free)
- **Backend Hosting**: Render Web Service (750h/month free)
- **Database**: Neon PostgreSQL (0.5GB free)
- **Cache**: Redis Cloud (30MB free)
- **Files**: Cloudflare R2 (10GB free)
- **DNS**: GoDaddy → Cloudflare
- **Domain**: easypado.com

## Features

### Core Platform
- ✅ Multi-tenant architecture (company + CA practice)
- ✅ Firebase authentication (phone + email OTP, TOTP, passkeys)
- ✅ Session management (30-day expiry, multi-device)
- ✅ RBAC (15 default roles, custom roles, ABAC policies)
- ✅ Comprehensive audit logging (hash-chained, immutable)
- ✅ Outbox pattern for reliable event publishing
- ✅ Idempotency keys (24-hour expiry)
- ✅ Rate limiting (per-user, per-IP)
- ✅ ETag-based concurrency control
- ✅ RFC 9457 error responses
- ✅ Soft delete with undo tokens
- ✅ Global search
- ✅ Email/WhatsApp notifications
- ✅ Background jobs (Arq workers)
- ✅ File attachments (S3-compatible)
- ✅ Webhook subscriptions

### Business Management
- ✅ Chart of Accounts (COA) with bank accounts
- ✅ General Ledger (GL) with double-entry
- ✅ Accounting periods (lock/unlock/reopen)
- ✅ Tax engine (GST, TDS, TCS, round-off)
- ✅ 14 document types (invoices, bills, quotes, POs, etc.)
- ✅ Document lifecycle (draft → post → send → pay)
- ✅ Payments & receipts with allocation
- ✅ Bank feed (auto-fetch, match rules, reconcile)
- ✅ Inventory/stock management
- ✅ Fixed assets (depreciation, disposal)
- ✅ Projects & budget tracking
- ✅ GST returns (GSTR-1, 3B, 2B recon)
- ✅ Dashboard with KPIs
- ✅ 100+ business operations

### CA Practice
- ✅ Multi-client dashboard
- ✅ Client onboarding & linking
- ✅ Compliance calendar (auto-generated)
- ✅ Task management (Kanban)
- ✅ Review queue (auto-detect anomalies)
- ✅ Document requests & sharing
- ✅ Client queries/messaging
- ✅ Time tracking & billing
- ✅ Team capacity management
- ✅ 45+ CA-specific endpoints

### Super-User Console
- ✅ System overview & metrics
- ✅ Console issues tracking
- ✅ Trace timeline (logs, audit, jobs)
- ✅ Session management
- ✅ Job management
- ✅ Integration health monitoring
- ✅ Feature flags
- ✅ Tenant management
- ✅ View-as (read-only user impersonation)

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 20+
- Docker & Docker Compose
- Git

### Local Development

#### 1. Clone the repository
```bash
git clone https://github.com/yourusername/byjan-platform.git
cd byjan-platform
```

#### 2. Set up backend
```bash
cd apps/backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e .

# Install dev dependencies
pip install -e ".[dev]"

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
# Required:
# - DATABASE_URL (Neon Postgres)
# - REDIS_URL (Redis Cloud)
# - FIREBASE_PROJECT_ID
# - JWT_SECRET_KEY
# - SECRET_KEY
```

#### 3. Set up frontend
```bash
cd apps/frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
# Required:
# - VITE_API_URL (backend URL)
# - VITE_APP_URL (frontend URL)
```

#### 4. Run database migrations
```bash
cd apps/backend

# Run migrations
alembic upgrade head

# Or use Python
python -c "from app.shared.database import init_db; import asyncio; asyncio.run(init_db())"
```

#### 5. Start services

**Terminal 1 - Backend:**
```bash
cd apps/backend
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd apps/frontend
npm run dev
```

**Terminal 3 - Worker (optional):**
```bash
cd apps/backend
arq app.worker.WorkerSettings
```

#### 6. Access the application
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs (dev only)
- Trace Console: http://localhost:5173/console

### Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

## Deployment

### Backend (Render)

1. **Create Render account** at https://render.com

2. **Create PostgreSQL database:**
   - Service type: PostgreSQL
   - Plan: Starter (free tier)
   - Database name: byjan_business
   - User: byjan_user

3. **Create Redis:**
   - Service type: Redis
   - Plan: Starter (free tier)
   - Maxmemory policy: allkeys-lru

4. **Deploy web service:**
   - Connect GitHub repository
   - Select branch: byjan_business
   - Runtime: Docker
   - Dockerfile: ./apps/backend/Dockerfile
   - Docker context: ./apps/backend
   - Health check path: /health

5. **Set environment variables:**
   - DATABASE_URL (from PostgreSQL service)
   - REDIS_URL (from Redis service)
   - JWT_SECRET_KEY (generate)
   - SECRET_KEY (generate)
   - FIREBASE_PROJECT_ID
   - WHATSAPP_ACCESS_TOKEN (optional - uses mock adapter if not set)
   - GSP_API_KEY (optional - uses mock adapter if not set)
   - S3_ENDPOINT (optional - uses mock adapter if not set)
   - S3_ACCESS_KEY_ID (optional)
   - S3_SECRET_ACCESS_KEY (optional)
   - EMAIL_API_KEY (optional)
   - ALLOWED_ORIGINS: https://business.easypado.com,https://app.easypado.com

6. **Deploy worker service:**
   - Same repository and branch
   - Runtime: Docker
   - Dockerfile: ./apps/backend/Dockerfile
   - Docker context: ./apps/backend
   - Command: `arq app.worker.WorkerSettings`

### Frontend (Cloudflare Pages)

1. **Create Cloudflare account** at https://cloudflare.com

2. **Add domain easypado.com:**
   - Go to Websites → Add site
   - Enter domain: easypado.com
   - Select Free plan
   - Update nameservers in GoDaddy to Cloudflare nameservers

3. **Create Pages project:**
   - Go to Pages → Create a project
   - Connect to Git
   - Select repository: byjan-platform
   - Build settings:
     - Framework: None (or Vite)
     - Build command: `npm run build`
     - Build output directory: `apps/frontend/dist`
     - Root directory: `apps/frontend`

4. **Set environment variables:**
   - VITE_API_URL: https://api.easypado.com
   - VITE_APP_URL: https://business.easypado.com

5. **Configure custom domains:**
   - Add custom domain: business.easypado.com
   - Add custom domain: app.easypado.com

### DNS Configuration (GoDaddy)

1. **Update nameservers:**
   - Go to GoDaddy → DNS Management
   - Update nameservers to Cloudflare nameservers
   - Wait for propagation (up to 24 hours)

2. **Configure DNS records in Cloudflare:**
   - A record: api.easypado.com → Render IP (or CNAME to Render)
   - CNAME record: business.easypado.com → Cloudflare Pages
   - CNAME record: app.easypado.com → Cloudflare Pages

### Final URLs

- **Frontend**: https://business.easypado.com
- **Backend API**: https://api.easypado.com
- **Trace Console**: https://business.easypado.com/console
- **API Docs**: https://api.easypado.com/docs (dev only)

## Testing

### Run all tests
```bash
cd apps/backend
pytest tests/ -v --cov=app --cov-report=html
```

### Run specific test file
```bash
pytest tests/test_business_calculations.py -v
```

### Run with coverage
```bash
pytest tests/ --cov=app --cov-report=term-missing --cov-report=html
```

### Load testing (free tier)
```bash
# Install k6
choco install k6  # Windows
# or
brew install k6  # macOS

# Run load test (small dataset for free tier)
k6 run tests/load_test.js
```

### Integration testing
```bash
# Test API endpoints
pytest tests/test_api_endpoints.py -v

# Test with real database
pytest tests/test_integration.py -v
```

## API Documentation

### Authentication
```
POST /v1/auth/firebase/exchange    # Exchange Firebase token
POST /v1/auth/otp/send             # Send OTP
POST /v1/auth/otp/verify           # Verify OTP
POST /v1/auth/refresh              # Refresh token
POST /v1/auth/logout               # Logout
```

### Business Operations
```
GET    /v1/business/dashboard        # Dashboard KPIs
GET    /v1/business/accounts         # Chart of accounts
GET    /v1/business/documents         # Documents (14 types)
POST   /v1/business/documents        # Create document
GET    /v1/business/payments         # Payments & receipts
GET    /v1/business/bank             # Bank feed
GET    /v1/business/tax              # Tax returns
```

### CA Practice
```
GET    /v1/ca/dashboard              # CA dashboard
GET    /v1/ca/clients                # Client list
GET    /v1/ca/compliance             # Compliance calendar
GET    /v1/ca/tasks                  # Task management
GET    /v1/ca/review-queue           # Review queue
```

### Console
```
GET    /v1/console/overview           # Console overview
GET    /v1/console/traces             # Trace events
GET    /v1/console/issues            # Console issues
GET    /v1/console/integration-health # Integration health
```

## Monitoring & Logging

### Trace Console
Access the comprehensive trace console at `/console/traces` to monitor:

- **Integration Health**: Firebase, WhatsApp, GSP, Database, Redis, Storage, Email
- **Event Stream**: All system events with severity filtering
- **Console Issues**: Critical, warning, info, debug issues
- **Audit Trail**: Complete audit log with hash chaining
- **Performance**: API latency, database queries, worker jobs
- **Errors**: All errors with context and stack traces

### Alerting
The system automatically logs warnings for:
- Missing API keys (WhatsApp, GSP, etc.)
- Integration failures
- Slow queries (>500ms)
- High error rates
- Rate limit violations
- Session anomalies

## Security

### Authentication
- Firebase ID token exchange
- OTP (SMS, email, WhatsApp)
- TOTP (authenticator apps)
- Passkeys/WebAuthn
- Multi-device sessions
- Step-up authentication

### Authorization
- 15 default roles
- Custom roles with permissions
- ABAC policies
- Resource-level permissions
- Tenant isolation
- Row-level security (RLS)

### Data Protection
- Encryption at rest (PostgreSQL, S3)
- Encryption in transit (TLS 1.3)
- Field-level encryption (PAN, bank accounts)
- Audit log hash chaining
- Soft delete with undo tokens
- GDPR compliance

## Performance

### Optimization
- Database indexing (75+ indexes)
- Query optimization
- Connection pooling
- Redis caching
- CDN (Cloudflare)
- Gzip compression

### Scalability
- Horizontal scaling (Render auto-scales)
- Database sharding (Neon)
- Redis clustering
- Async workers (Arq)
- Edge caching (Cloudflare)

## Troubleshooting

### Common Issues

#### 1. Database connection error
```
Error: could not connect to database
```
**Solution:** Check DATABASE_URL in .env, ensure Neon database is running

#### 2. Redis connection error
```
Error: could not connect to Redis
```
**Solution:** Check REDIS_URL in .env, ensure Redis Cloud is running

#### 3. Firebase authentication error
```
Error: Firebase project not found
```
**Solution:** Check FIREBASE_PROJECT_ID in .env, ensure Firebase project exists

#### 4. Integration warnings in Trace Console
```
WARNING | WhatsApp API Key Missing
```
**Solution:** Add WHATSAPP_ACCESS_TOKEN in Render environment variables

#### 5. Frontend not loading
```
Error: Failed to fetch
```
**Solution:** Check VITE_API_URL in frontend .env, ensure backend is running

## Contributing

1. Create a feature branch from `byjan_business`
2. Make changes
3. Add tests
4. Run tests: `pytest tests/ -v`
5. Create pull request

## License

Proprietary - Byjan Business

## Support

For issues, check the Trace Console at `/console/traces` or contact support@byjan.com
