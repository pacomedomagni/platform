#!/bin/bash
set -euo pipefail

# NoSlag Staging Deploy — Droplet 104.248.51.126
# Builds locally, pushes images via SSH, starts on droplet

DROPLET="loni-server"
DEPLOY_DIR="/opt/noslag"
COMPOSE_FILE="docker-compose.droplet.yml"

echo "=== NoSlag Staging Deploy ==="
echo "Target: $DROPLET ($DEPLOY_DIR)"
echo ""

# 1. Build Docker images locally (AMD64 for droplet)
echo "[1/5] Building Docker images (linux/amd64)..."
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose -f "$COMPOSE_FILE" build api web

# 2. Save images to tarballs
echo "[2/5] Saving images..."
docker save noslag-api:staging | gzip > /tmp/noslag-api.tar.gz
docker save noslag-web:staging | gzip > /tmp/noslag-web.tar.gz

# 3. Transfer to droplet
echo "[3/5] Transferring images to droplet..."
scp /tmp/noslag-api.tar.gz /tmp/noslag-web.tar.gz "$DROPLET:/tmp/"

# 4. Load images and sync config on droplet
echo "[4/5] Loading images on droplet..."
ssh "$DROPLET" "
  docker load < /tmp/noslag-api.tar.gz
  docker load < /tmp/noslag-web.tar.gz
  rm -f /tmp/noslag-api.tar.gz /tmp/noslag-web.tar.gz
  mkdir -p $DEPLOY_DIR
"

# Sync compose file, env, and support files
echo "Syncing config files..."
rsync -avz --delete \
  "$COMPOSE_FILE" \
  .env.staging \
  docker/keycloak/ \
  docker/postgres_init/ \
  docker/loki/ \
  docker/promtail/ \
  "$DROPLET:$DEPLOY_DIR/"

# Restructure support dirs on droplet
ssh "$DROPLET" "
  cd $DEPLOY_DIR
  mkdir -p docker/keycloak docker/postgres_init docker/loki docker/promtail
  # Move files if they landed flat
  [ -f noslag-realm.json ] && mv noslag-realm.json docker/keycloak/ 2>/dev/null || true
  [ -f 01_init_keycloak.sql ] && mv 01_init_keycloak.sql docker/postgres_init/ 2>/dev/null || true
  [ -f 02_init_app_user.sql ] && mv 02_init_app_user.sql docker/postgres_init/ 2>/dev/null || true
  [ -f loki-config.yml ] && mv loki-config.yml docker/loki/ 2>/dev/null || true
  [ -f promtail-config.yml ] && mv promtail-config.yml docker/promtail/ 2>/dev/null || true
  # Rename env file
  cp .env.staging .env 2>/dev/null || true
"

# 5. Start services
echo "[5/5] Starting services..."
ssh "$DROPLET" "
  cd $DEPLOY_DIR
  docker compose -f $COMPOSE_FILE --env-file .env down --remove-orphans || true
  docker compose -f $COMPOSE_FILE --env-file .env up -d
  echo ''
  echo '=== Waiting for services... ==='
  sleep 10
  docker compose -f $COMPOSE_FILE ps
"

echo ""
echo "=== Deploy complete ==="
echo "API:      http://104.248.51.126:6000/api/v1/health"
echo "Web:      http://104.248.51.126:6001"
echo "Keycloak: http://104.248.51.126:6080"
echo "MinIO:    http://104.248.51.126:6091"
echo "Loki:     http://127.0.0.1:6100 (localhost only)"
echo "Postgres: 104.248.51.126:6032"
echo "Redis:    104.248.51.126:6079"

# Cleanup local tarballs
rm -f /tmp/noslag-api.tar.gz /tmp/noslag-web.tar.gz
