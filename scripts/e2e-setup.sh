#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# NoSlag E2E Environment Setup
# Starts Docker infrastructure, runs migrations, seeds data,
# and starts the API server for E2E testing.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()   { echo -e "${BLUE}[E2E]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================
# Phase 1: Start Docker Infrastructure
# ============================================================
log "Phase 1: Starting Docker infrastructure..."

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis minio keycloak

ok "Docker containers started"

# ============================================================
# Phase 2: Wait for services to be healthy
# ============================================================
log "Phase 2: Waiting for services..."

# Wait for PostgreSQL
log "  Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec noslag_postgres pg_isready -U noslag -q 2>/dev/null; then
    ok "  PostgreSQL is ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    err "PostgreSQL failed to start"
    exit 1
  fi
  sleep 1
done

# Wait for Redis
log "  Waiting for Redis..."
for i in $(seq 1 15); do
  if docker exec noslag_redis redis-cli ping 2>/dev/null | grep -q PONG; then
    ok "  Redis is ready"
    break
  fi
  if [ "$i" -eq 15 ]; then
    err "Redis failed to start"
    exit 1
  fi
  sleep 1
done

# Wait for Keycloak (can take a while on first start)
log "  Waiting for Keycloak (may take 30-60s on first start)..."
for i in $(seq 1 60); do
  if curl -sf http://localhost:8080/health/ready >/dev/null 2>&1; then
    ok "  Keycloak is ready"
    break
  fi
  if [ "$i" -eq 60 ]; then
    warn "Keycloak health check timed out (may still be starting)"
  fi
  sleep 2
done

# Wait for MinIO
log "  Waiting for MinIO..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:9000/minio/health/live >/dev/null 2>&1; then
    ok "  MinIO is ready"
    break
  fi
  if [ "$i" -eq 15 ]; then
    warn "MinIO health check timed out"
  fi
  sleep 1
done

# ============================================================
# Phase 3: Database Migrations
# ============================================================
log "Phase 3: Running Prisma migrations..."

# Export DATABASE_URL for localhost access
export DATABASE_URL="postgresql://noslag:noslag_password@localhost:5432/noslag_db?schema=public"

npx prisma migrate deploy 2>&1 | tail -5

ok "Migrations complete"

# ============================================================
# Phase 4: MinIO Bucket Creation
# ============================================================
log "Phase 4: Creating MinIO bucket..."

# Use the MinIO client via Docker to create the bucket
docker run --rm --network noslag_network \
  --entrypoint sh minio/mc:latest -c "
    mc alias set myminio http://noslag_minio:9000 minioadmin minioadmin 2>/dev/null;
    mc mb --ignore-existing myminio/noslag-uploads 2>/dev/null;
    mc anonymous set download myminio/noslag-uploads 2>/dev/null;
    echo 'Bucket ready'
  " 2>/dev/null || warn "MinIO bucket creation skipped (mc image may need to be pulled)"

ok "MinIO bucket configured"

# ============================================================
# Phase 5: Seed Test Tenant
# ============================================================
log "Phase 5: Seeding test tenant..."

npx tsx scripts/seed-e2e-tenant.ts

ok "Test tenant seeded"

# ============================================================
# Phase 6: Start API Server
# ============================================================
log "Phase 6: Starting API server..."

# Check if API is already running
if curl -sf http://localhost:3000/api/v1/health >/dev/null 2>&1; then
  ok "API is already running on port 3000"
else
  log "  Starting API with .env.e2e configuration..."

  # Start API in background using env-cmd (or direct env export)
  (
    set -a
    source .env.e2e
    # Defensive defaults — .env.e2e is gitignored so individual dev
    # copies can drift. The payments-config e2e test asserts
    # isConfigured: true, which requires Stripe to be in mock mode.
    : "${MOCK_PAYMENTS:=true}"
    : "${MOCK_EXTERNAL_SERVICES:=true}"
    set +a
    npx nx serve api &
  )

  API_PID=$!
  echo "$API_PID" > .e2e-api.pid

  # ============================================================
  # Phase 7: Wait for API Health
  # ============================================================
  log "Phase 7: Waiting for API to be ready..."

  for i in $(seq 1 60); do
    if curl -sf http://localhost:3000/api/v1/health >/dev/null 2>&1; then
      ok "API is ready on http://localhost:3000"
      break
    fi
    if [ "$i" -eq 60 ]; then
      err "API failed to start within 120 seconds"
      exit 1
    fi
    sleep 2
  done
fi

# ============================================================
# Phase 8: Summary
# ============================================================
echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN} E2E Environment Ready!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "  API:        http://localhost:3000/api/v1"
echo -e "  Health:     http://localhost:3000/api/v1/health"
echo -e "  Keycloak:   http://localhost:8080"
echo -e "  MinIO:      http://localhost:9001 (console)"
echo -e "  PgAdmin:    http://localhost:5050 (optional)"
echo ""
echo -e "  Admin:      admin@noslag.com / admin123"
echo -e "  Tenant ID:  8d334424-054e-4452-949c-21ecc1fff2c0"
echo ""
echo -e "  Run tests:  ${YELLOW}npx nx e2e api-e2e${NC}"
echo -e "  Teardown:   ${YELLOW}bash scripts/e2e-teardown.sh${NC}"
echo ""
