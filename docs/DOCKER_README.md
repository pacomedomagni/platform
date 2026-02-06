# NoSlag Platform - Docker Deployment Guide

This guide covers running the complete NoSlag platform using Docker.

## Prerequisites

- Docker Desktop installed and running
- At least 4GB RAM allocated to Docker
- 10GB free disk space

## Quick Start Options

### Option 1: Full Docker Build (Recommended for Production-like Testing)

This builds Docker images for both API and Web, runs everything in containers.

```bash
./docker-start.sh
```

**Time:** 5-10 minutes (first time)
**Use case:** Testing production builds, full stack deployment

### Option 2: Quick Infrastructure Start (Recommended for Development)

This starts only infrastructure services (DB, Redis, etc.). Run API/Web locally for faster development.

```bash
./docker-quick-start.sh

# Then in separate terminals:
npx nx serve api
npx nx serve web
```

**Time:** 1-2 minutes
**Use case:** Active development with hot reload

## What Gets Started

### Infrastructure Services
- **PostgreSQL** (port 5432) - Main database
- **Redis** (port 6379) - Queue and caching
- **MinIO** (ports 9000, 9001) - S3-compatible object storage
- **Keycloak** (port 8080) - Authentication provider
- **PgAdmin** (port 5050) - Database management UI

### Application Services (Full Docker only)
- **API** (port 3000) - NestJS backend
- **Web** (via Traefik on port 80) - Next.js frontend
- **Traefik** (port 80, dashboard 8081) - Reverse proxy

## Access URLs

After successful startup:

### Application
- **Landing Page:** http://localhost/landing
- **Storefront:** http://localhost/storefront
- **Admin Dashboard:** http://localhost/app
- **API:** http://localhost/api
- **API Health:** http://localhost/api/health

### Infrastructure
- **Keycloak Admin:** http://localhost:8080
  - Username: `admin`
  - Password: `admin`
- **MinIO Console:** http://localhost:9001
  - Username: `minioadmin`
  - Password: `minioadmin`
- **PgAdmin:** http://localhost:5050
  - Email: `admin@noslag.com`
  - Password: `admin`
- **Traefik Dashboard:** http://localhost:8081 (Full Docker only)

## Configuration

### Environment Variables

The startup scripts create `.env.docker` with default development settings.

**Important configurations to update:**

```bash
# SendGrid (for emails)
SENDGRID_API_KEY=your_actual_key_here
EMAIL_FROM_ADDRESS=noreply@yourdomain.com

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here

# JWT Secret (change in production!)
JWT_SECRET=your-very-secure-random-secret-here
```

### Database Connection

**From host machine:**
```
Host: localhost
Port: 5432
Database: noslag_db
Username: noslag
Password: noslag_password
```

**From Docker containers:**
```
Host: noslag_postgres
Port: 5432
Database: noslag_db
Username: noslag
Password: noslag_password
```

**Connection String (host):**
```
postgresql://noslag:noslag_password@localhost:5432/noslag_db?schema=public
```

## Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f postgres
```

### Check Status
```bash
docker-compose ps
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart api
docker-compose restart web
```

### Stop Everything
```bash
docker-compose down
```

### Stop and Remove Volumes (⚠️ Deletes all data)
```bash
docker-compose down -v
```

### Rebuild Services
```bash
# Rebuild all
docker-compose build --no-cache

# Rebuild specific service
docker-compose build --no-cache api
docker-compose up -d api
```

## Database Operations

### Run Migrations
```bash
# If running full Docker:
docker exec noslag_api npx prisma migrate deploy

# If running locally:
npx prisma migrate deploy
```

### Create New Migration
```bash
npx prisma migrate dev --name your_migration_name
```

### Prisma Studio (Database GUI)
```bash
npx prisma studio
```

### Reset Database (⚠️ Deletes all data)
```bash
npx prisma migrate reset
```

### Backup Database
```bash
docker exec noslag_postgres pg_dump -U noslag noslag_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database
```bash
docker exec -i noslag_postgres psql -U noslag noslag_db < backup_file.sql
```

## Troubleshooting

### API Won't Start

**Check logs:**
```bash
docker-compose logs api
```

**Common issues:**
- Database not ready → Wait 30s and restart: `docker-compose restart api`
- Migration failed → Run manually: `docker exec noslag_api npx prisma migrate deploy`
- Port 3000 already in use → Stop local processes: `lsof -ti:3000 | xargs kill -9`

### Web Won't Start

**Check logs:**
```bash
docker-compose logs web
```

**Common issues:**
- API not ready → Ensure API is healthy: `curl http://localhost:3000/api/health`
- Build failed → Rebuild: `docker-compose build --no-cache web && docker-compose up -d web`

### PostgreSQL Won't Start

**Check logs:**
```bash
docker-compose logs postgres
```

**Common issues:**
- Port 5432 in use → Stop other PostgreSQL: `brew services stop postgresql`
- Volume corruption → Remove and recreate:
  ```bash
  docker-compose down -v
  rm -rf docker/postgres_data
  docker-compose up -d postgres
  ```

### Out of Disk Space

**Clean up Docker:**
```bash
# Remove unused images
docker image prune -a -f

# Remove unused volumes
docker volume prune -f

# Remove everything (⚠️ Deletes all Docker data)
docker system prune -a --volumes -f
```

### Port Conflicts

If ports are already in use, edit `docker-compose.yml` to change:
- PostgreSQL: `5432:5432` → `5433:5432`
- Redis: `6379:6379` → `6380:6379`
- MinIO: `9000:9000` → `9010:9000`
- etc.

### Redis Connection Issues

**Test connection:**
```bash
docker exec noslag_redis redis-cli ping
# Should return: PONG
```

**Clear cache:**
```bash
docker exec noslag_redis redis-cli FLUSHALL
```

## Performance Optimization

### Allocate More Resources

Docker Desktop → Settings → Resources:
- **CPUs:** 4+ cores recommended
- **Memory:** 6-8GB recommended
- **Swap:** 2GB
- **Disk:** 20GB+

### Speed Up Builds

**Use BuildKit:**
```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
docker-compose build
```

**Cache node_modules:**
Add to `.dockerignore`:
```
node_modules
dist
.nx
```

## Testing the Complete Flow

### 1. Start the Platform
```bash
./docker-start.sh
```

### 2. Test Landing Page
Visit: http://localhost/landing

- Verify all 8 sections load
- Check animations work
- Test CTA buttons

### 3. Test Registration & Onboarding
1. Click "Start Free Trial"
2. Register with test email
3. Complete welcome wizard
4. View onboarding checklist
5. Take product tour

### 4. Test Email Verification
**Note:** Requires SendGrid API key configured

1. Check logs for verification email:
   ```bash
   docker-compose logs -f api | grep "Verification email"
   ```
2. Copy verification link from logs
3. Open in browser
4. Verify success message

### 5. Test Storefront
1. Browse products: http://localhost/storefront/products
2. Add items to cart
3. Complete checkout
4. View order confirmation

### 6. Test Admin Dashboard
1. Login to admin: http://localhost/app
2. View orders dashboard
3. Check customer list
4. Export data

## Production Deployment

For production, use:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Key differences:**
- Environment variables from secrets
- SSL/TLS enabled
- Health checks configured
- Log aggregation
- Auto-restart policies
- Resource limits

## Cleanup Scripts

### Stop All Services
```bash
./docker-stop.sh
```

### Complete Cleanup (⚠️ Deletes all data)
```bash
./docker-cleanup.sh
```

## Monitoring

### Health Checks
```bash
# API health
curl http://localhost:3000/api/health

# PostgreSQL
docker exec noslag_postgres pg_isready

# Redis
docker exec noslag_redis redis-cli ping
```

### Resource Usage
```bash
docker stats
```

## Support

**Common Commands Cheat Sheet:**

| Task | Command |
|------|---------|
| Start all | `./docker-start.sh` |
| Start infra only | `./docker-quick-start.sh` |
| View logs | `docker-compose logs -f` |
| Stop all | `docker-compose down` |
| Restart service | `docker-compose restart [service]` |
| Check status | `docker-compose ps` |
| Clean up | `docker-compose down -v` |
| Rebuild | `docker-compose build --no-cache` |

**Need help?** Check logs first with `docker-compose logs -f`
