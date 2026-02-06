#!/bin/bash

# Stop all Docker services gracefully

echo "Stopping all NoSlag services..."
docker-compose down

echo "✓ All services stopped"
echo ""
echo "To remove volumes (deletes all data): docker-compose down -v"
echo "To start again: ./docker-start.sh"
