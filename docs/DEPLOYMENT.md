# Production Deployment Guide

This guide covers deploying Noslag to production with all Phase 1 infrastructure.

## Prerequisites

- Docker & Docker Compose v2+
- Domain with DNS access
- Server with 4GB+ RAM (8GB recommended)
- S3-compatible storage (or MinIO)
- Sentry account for error tracking

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone <repo-url> noslag
cd noslag

# Copy environment template
cp .env.production.example .env.prod

# Edit with your values
nano .env.prod
```

### 2. Configure DNS

Point these records to your server:
- `yourdomain.com` → Server IP
- `api.yourdomain.com` → Server IP (or same as above)
- `*.yourdomain.com` → Server IP (for subdomains)

### 3. Create Required Directories

```bash
# Traefik needs these directories
mkdir -p docker/traefik/acme
chmod 600 docker/traefik/acme

# Backup storage (if using local)
mkdir -p backups
```

### 4. Deploy

```bash
# Build images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

### 5. Run Migrations

```bash
# Run database migrations
docker compose exec api npx prisma migrate deploy

# Seed default data (optional, for new installations)
docker compose exec api npx ts-node -e "import('./src/app/provisioning/seed.service').then(m => new m.SeedService(prisma).seedDefaults())"
```

## Service Architecture

```
                    ┌─────────────┐
                    │   Internet  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Traefik   │ ← SSL termination, rate limiting
                    │   :80/:443  │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼─────┐     ┌─────▼─────┐
    │   Web   │      │    API    │     │   Desk    │
    │  :3000  │      │   :3333   │     │   :3001   │
    └────┬────┘      └─────┬─────┘     └─────┬─────┘
         │                 │                 │
         │           ┌─────┼─────┐           │
         │           │     │     │           │
         │     ┌─────▼──┐ ┌▼────┐│           │
         │     │Postgres│ │Redis││           │
         │     │ :5432  │ │:6379││           │
         │     └────────┘ └─────┘│           │
         │           │           │           │
         │     ┌─────▼─────┐     │           │
         │     │   MinIO   │     │           │
         │     │   :9000   │     │           │
         │     └───────────┘     │           │
         │                       │           │
         └───────────────────────┴───────────┘
```

## Health Checks

All services expose health endpoints:

```bash
# API health (detailed)
curl https://api.yourdomain.com/health

# API readiness (quick)
curl https://api.yourdomain.com/health/ready

# API liveness (minimal)
curl https://api.yourdomain.com/health/live

# Web health
curl https://yourdomain.com/api/health
```

## Backup & Restore

### Automatic Backups

Backups run automatically via cron (default: 2 AM daily).

Check backup status:
```bash
docker compose logs backup
```

### Manual Backup

```bash
docker compose exec backup /backup.sh
```

### Restore

```bash
# List available backups
docker compose exec backup /restore.sh list

# Restore latest
docker compose exec backup /restore.sh latest

# Restore specific backup
docker compose exec backup /restore.sh 2024-01-15-020000
```

### Backup Storage

Backups are stored in S3 with:
- **Encryption**: AES-256 with your `BACKUP_ENCRYPTION_KEY`
- **Retention**: Configurable via `BACKUP_RETENTION_DAYS`
- **Structure**: `s3://bucket/backups/{date}/noslag_{timestamp}.sql.gz.enc`

## Monitoring

### Error Tracking (Sentry)

All errors are automatically captured and sent to Sentry with:
- User context (tenant, user ID)
- Request context (URL, method, headers)
- Environment info (Node version, release)

View errors at: https://sentry.io/organizations/your-org/

### Metrics

Prometheus metrics available at:
```bash
curl https://api.yourdomain.com/metrics  # If enabled
```

### Logs

View logs:
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api

# Last 100 lines
docker compose logs --tail=100 api
```

## Scaling

### Horizontal Scaling (API)

The production compose file already configures 2 API replicas. To scale:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api=3
```

Traefik automatically load-balances across all instances.

### Database Scaling

For high-traffic deployments:
1. Move PostgreSQL to managed service (RDS, Cloud SQL)
2. Add read replicas
3. Update `DATABASE_URL` accordingly

## Security Checklist

- [ ] Strong passwords in `.env.prod`
- [ ] Backup encryption key stored securely
- [ ] Sentry DSN configured
- [ ] CORS origins restricted
- [ ] Rate limiting enabled (via Traefik)
- [ ] SSL certificates active (Let's Encrypt)
- [ ] Database not exposed externally
- [ ] Redis password set
- [ ] MinIO credentials changed from defaults

## Troubleshooting

### SSL Certificate Issues

```bash
# Check Traefik logs
docker compose logs traefik

# Verify ACME account
cat docker/traefik/acme/acme.json

# Force certificate renewal
rm docker/traefik/acme/acme.json
docker compose restart traefik
```

### Database Connection Issues

```bash
# Check PostgreSQL logs
docker compose logs postgres

# Test connection
docker compose exec api npx prisma db pull
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart specific service
docker compose restart api
```

### Backup Failures

```bash
# Check backup logs
docker compose logs backup

# Test S3 connectivity
docker compose exec backup aws s3 ls s3://$BACKUP_S3_BUCKET

# Manual backup test
docker compose exec backup /backup.sh
```

## Updates

### Applying Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Run migrations
docker compose exec api npx prisma migrate deploy
```

### Zero-Downtime Updates

With multiple API replicas, updates are rolling by default:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps api
```

## Support

- **Documentation**: See `/docs` directory
- **Issues**: GitHub Issues
- **Emergency**: Check Sentry for errors, logs for details
