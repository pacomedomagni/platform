#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# NoSlag E2E Environment Teardown
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[E2E]${NC} $1"; }
ok()  { echo -e "${GREEN}[OK]${NC} $1"; }

# Stop API server if PID file exists
if [ -f .e2e-api.pid ]; then
  API_PID=$(cat .e2e-api.pid)
  if kill -0 "$API_PID" 2>/dev/null; then
    log "Stopping API server (PID $API_PID)..."
    kill "$API_PID" 2>/dev/null || true
    ok "API server stopped"
  fi
  rm -f .e2e-api.pid
fi

# Also try to kill anything on port 3000
if lsof -ti:3000 >/dev/null 2>&1; then
  log "Killing processes on port 3000..."
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  ok "Port 3000 cleared"
fi

# Stop Docker infrastructure
WIPE_VOLUMES="${1:-}"

if [ "$WIPE_VOLUMES" = "--wipe" ] || [ "$WIPE_VOLUMES" = "-w" ]; then
  log "Stopping Docker services and wiping volumes..."
  docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v 2>/dev/null || true
  rm -rf docker/postgres_data docker/minio_data docker/loki_data
  ok "Docker services stopped and volumes wiped"
else
  log "Stopping Docker services (keeping volumes)..."
  docker compose -f docker-compose.yml -f docker-compose.dev.yml down 2>/dev/null || true
  ok "Docker services stopped (data preserved for next run)"
fi

echo ""
echo -e "${GREEN}Teardown complete.${NC}"
echo -e "  Use ${RED}--wipe${NC} flag to also remove volumes: bash scripts/e2e-teardown.sh --wipe"
