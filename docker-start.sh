#!/bin/bash

# NoSlag Platform - Local Docker Deployment Script
# This script builds and starts the complete platform stack

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}NoSlag Platform - Docker Deployment${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Function to print colored messages
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
info "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker Desktop."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    error "docker-compose is not installed. Please install docker-compose."
    exit 1
fi

success "Docker is installed"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running. Please start Docker Desktop."
    exit 1
fi

success "Docker is running"

# Create .env.docker if it doesn't exist
info "Setting up environment variables..."

if [ ! -f .env.docker ]; then
    cat > .env.docker << 'EOF'
# PostgreSQL Configuration
POSTGRES_USER=noslag
POSTGRES_PASSWORD=noslag_password
POSTGRES_DB=noslag_db

# Database URLs
DATABASE_URL=postgresql://noslag:noslag_password@noslag_postgres:5432/noslag_db?schema=public
APP_DATABASE_URL=postgresql://app_user:app_password@noslag_postgres:5432/noslag_db?schema=public

# Redis Configuration
REDIS_URL=redis://noslag_redis:6379

# MinIO Configuration
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_ENDPOINT=noslag_minio:9000
MINIO_BUCKET_NAME=noslag-uploads

# Keycloak Configuration
KC_DB_URL=jdbc:postgresql://noslag_postgres:5432/keycloak
KC_DB_USERNAME=keycloak
KC_DB_PASSWORD=password
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin
KEYCLOAK_JWKS_URI=http://noslag_keycloak:8080/realms/noslag/protocol/openid-connect/certs
KEYCLOAK_ISSUER=http://localhost:8080/realms/noslag

# API Configuration
PORT=3000
NODE_ENV=development
JWT_SECRET=dev-only-secret-change-in-production

# Email Configuration (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM_NAME="NoSlag Support"
EMAIL_FROM_ADDRESS=noreply@noslag.com
SENDGRID_WEBHOOK_VERIFICATION_KEY=your_webhook_verification_key_here

# Frontend URLs
FRONTEND_URL=http://localhost
STORE_URL=http://localhost
NEXT_PUBLIC_API_URL=http://localhost/api/v1

# Stripe Configuration (Optional)
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# PgAdmin Configuration
PGADMIN_DEFAULT_EMAIL=admin@noslag.com
PGADMIN_DEFAULT_PASSWORD=admin
EOF
    success "Created .env.docker file"
else
    info ".env.docker already exists"
fi

# Stop any running containers
info "Stopping existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true
success "Stopped existing containers"

# Clean up old images (optional - comment out if you want to keep them)
info "Cleaning up old Docker images..."
docker image prune -f > /dev/null 2>&1 || true

# Build the application
info "Building application images (this may take 5-10 minutes)..."
echo ""

docker-compose build --no-cache --progress=plain

if [ $? -eq 0 ]; then
    success "Build completed successfully"
else
    error "Build failed. Please check the logs above."
    exit 1
fi

echo ""
info "Starting infrastructure services (PostgreSQL, Redis, MinIO, Keycloak)..."

# Start infrastructure first
docker-compose up -d postgres redis minio keycloak

# Wait for PostgreSQL to be ready
info "Waiting for PostgreSQL to be ready..."
max_attempts=30
attempt=0
until docker exec noslag_postgres pg_isready -U noslag > /dev/null 2>&1; do
    attempt=$((attempt+1))
    if [ $attempt -ge $max_attempts ]; then
        error "PostgreSQL did not start in time"
        docker-compose logs postgres
        exit 1
    fi
    echo -n "."
    sleep 2
done
echo ""
success "PostgreSQL is ready"

# Wait for Redis to be ready
info "Waiting for Redis to be ready..."
attempt=0
until docker exec noslag_redis redis-cli ping > /dev/null 2>&1; do
    attempt=$((attempt+1))
    if [ $attempt -ge $max_attempts ]; then
        error "Redis did not start in time"
        docker-compose logs redis
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo ""
success "Redis is ready"

# Run database migrations
info "Running database migrations..."
echo ""

# Create a temporary container to run migrations
docker run --rm \
    --network noslag_network \
    -v "$(pwd):/app" \
    -w /app \
    -e DATABASE_URL="postgresql://noslag:noslag_password@noslag_postgres:5432/noslag_db?schema=public" \
    node:20-alpine \
    sh -c "npm install && npx prisma migrate deploy"

if [ $? -eq 0 ]; then
    success "Database migrations completed"
else
    error "Database migrations failed"
    exit 1
fi

echo ""

# Start API service
info "Starting API service..."
docker-compose up -d api

# Wait for API to be healthy
info "Waiting for API to be ready..."
attempt=0
until curl -s http://localhost:3000/api/health > /dev/null 2>&1; do
    attempt=$((attempt+1))
    if [ $attempt -ge 60 ]; then
        error "API did not start in time"
        docker-compose logs api
        exit 1
    fi
    echo -n "."
    sleep 2
done
echo ""
success "API is ready"

# Start web service
info "Starting Web application..."
docker-compose up -d web

# Wait for web to be ready
info "Waiting for Web application to be ready..."
attempt=0
until curl -s http://localhost > /dev/null 2>&1; do
    attempt=$((attempt+1))
    if [ $attempt -ge 60 ]; then
        error "Web application did not start in time"
        docker-compose logs web
        exit 1
    fi
    echo -n "."
    sleep 2
done
echo ""
success "Web application is ready"

# Start remaining services
info "Starting remaining services (Traefik, PgAdmin)..."
docker-compose up -d traefik pgadmin

echo ""
success "All services started successfully!"
echo ""

# Display access information
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Platform is ready!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${BLUE}Access URLs:${NC}"
echo -e "  🌐 Storefront:           ${GREEN}http://localhost${NC}"
echo -e "  🚀 Landing Page:         ${GREEN}http://localhost/landing${NC}"
echo -e "  📦 API:                  ${GREEN}http://localhost/api${NC}"
echo -e "  🔐 Admin Dashboard:      ${GREEN}http://localhost/app${NC}"
echo -e "  📊 API Health:           ${GREEN}http://localhost/api/health${NC}"
echo ""

echo -e "${BLUE}Infrastructure:${NC}"
echo -e "  🔑 Keycloak Admin:       ${GREEN}http://localhost:8080${NC}"
echo -e "     Username: admin / Password: admin"
echo -e "  📁 MinIO Console:        ${GREEN}http://localhost:9001${NC}"
echo -e "     Username: minioadmin / Password: minioadmin"
echo -e "  🗄️  PgAdmin:              ${GREEN}http://localhost:5050${NC}"
echo -e "     Email: admin@noslag.com / Password: admin"
echo -e "  🔀 Traefik Dashboard:    ${GREEN}http://localhost:8081${NC}"
echo ""

echo -e "${BLUE}Database Connection:${NC}"
echo -e "  Host: localhost"
echo -e "  Port: 5432"
echo -e "  Database: noslag_db"
echo -e "  Username: noslag"
echo -e "  Password: noslag_password"
echo ""

echo -e "${YELLOW}Quick Test:${NC}"
echo -e "  1. Visit ${GREEN}http://localhost/landing${NC} to see the marketing page"
echo -e "  2. Click 'Start Free Trial' to register"
echo -e "  3. Complete the onboarding wizard"
echo -e "  4. Browse products and add to cart"
echo ""

echo -e "${YELLOW}Useful Commands:${NC}"
echo -e "  View logs:        ${GREEN}docker-compose logs -f${NC}"
echo -e "  Stop all:         ${GREEN}docker-compose down${NC}"
echo -e "  Restart service:  ${GREEN}docker-compose restart [service]${NC}"
echo -e "  View status:      ${GREEN}docker-compose ps${NC}"
echo ""

echo -e "${BLUE}Note:${NC} SendGrid API key needs to be configured in .env.docker for emails to work"
echo ""
