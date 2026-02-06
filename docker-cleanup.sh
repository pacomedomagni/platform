#!/bin/bash

# Complete cleanup of Docker environment
# ⚠️ WARNING: This deletes all data, containers, and images

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}========================================${NC}"
echo -e "${RED}⚠️  COMPLETE DOCKER CLEANUP ⚠️${NC}"
echo -e "${RED}========================================${NC}\n"

echo -e "${YELLOW}This will:${NC}"
echo "  - Stop all containers"
echo "  - Remove all containers"
echo "  - Remove all volumes (DATABASE WILL BE DELETED)"
echo "  - Remove all Docker images"
echo "  - Remove all networks"
echo ""

read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled"
    exit 0
fi

echo ""
echo "Stopping all services..."
docker-compose down -v

echo "Removing Docker images..."
docker rmi platform-api platform-web 2>/dev/null || true

echo "Removing local data directories..."
rm -rf docker/postgres_data
rm -rf docker/minio_data

echo "Pruning Docker system..."
docker system prune -a -f

echo ""
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""
echo "To start fresh: ./docker-start.sh"
