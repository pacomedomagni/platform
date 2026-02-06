#!/bin/bash

# NoSlag Platform - Quick Infrastructure Start (for local development)
# This script starts only infrastructure services (DB, Redis, MinIO, Keycloak)
# Run API and Web locally with npm for faster development

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}NoSlag - Quick Infrastructure Start${NC}"
echo -e "${BLUE}========================================${NC}\n"

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Start only infrastructure
info "Starting infrastructure services..."
docker-compose up -d postgres redis minio keycloak pgadmin

# Wait for PostgreSQL
info "Waiting for PostgreSQL..."
max_attempts=30
attempt=0
until docker exec noslag_postgres pg_isready -U noslag > /dev/null 2>&1; do
    attempt=$((attempt+1))
    if [ $attempt -ge $max_attempts ]; then
        echo "PostgreSQL did not start in time"
        exit 1
    fi
    echo -n "."
    sleep 2
done
echo ""
success "PostgreSQL is ready"

# Wait for Redis
info "Waiting for Redis..."
attempt=0
until docker exec noslag_redis redis-cli ping > /dev/null 2>&1; do
    attempt=$((attempt+1))
    if [ $attempt -ge $max_attempts ]; then
        echo "Redis did not start in time"
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo ""
success "Redis is ready"

# Run migrations
info "Running database migrations..."
npx prisma migrate deploy
success "Migrations completed"

# Generate Prisma client
info "Generating Prisma client..."
npx prisma generate
success "Prisma client generated"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Infrastructure is ready!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${BLUE}Infrastructure URLs:${NC}"
echo -e "  🗄️  PostgreSQL:           ${GREEN}localhost:5432${NC}"
echo -e "  🔴 Redis:                ${GREEN}localhost:6379${NC}"
echo -e "  📁 MinIO Console:        ${GREEN}http://localhost:9001${NC}"
echo -e "  🔑 Keycloak:             ${GREEN}http://localhost:8080${NC}"
echo -e "  🗄️  PgAdmin:              ${GREEN}http://localhost:5050${NC}"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Start API:  ${GREEN}cd apps/api && npm run start:dev${NC}"
echo -e "  2. Start Web:  ${GREEN}cd apps/web && npm run dev${NC}"
echo ""

echo -e "${YELLOW}Or use NX:${NC}"
echo -e "  ${GREEN}npx nx serve api${NC} (in one terminal)"
echo -e "  ${GREEN}npx nx serve web${NC} (in another terminal)"
echo ""

echo -e "${BLUE}Database Connection String:${NC}"
echo -e "  ${GREEN}postgresql://noslag:noslag_password@localhost:5432/noslag_db?schema=public${NC}"
echo ""
