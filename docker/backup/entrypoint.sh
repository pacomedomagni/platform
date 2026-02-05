#!/bin/bash
set -euo pipefail

# ============================================
# Backup Container Entrypoint
# ============================================
# Runs backups on a schedule using crond
# ============================================

BACKUP_SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"  # Default: 2 AM daily

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Create cron job
setup_cron() {
    log "Setting up backup schedule: ${BACKUP_SCHEDULE}"
    
    # Create cron file
    echo "${BACKUP_SCHEDULE} /scripts/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root
    
    # Ensure log file exists
    touch /var/log/backup.log
}

# Run backup immediately if requested
run_immediate() {
    if [[ "${RUN_IMMEDIATE:-false}" == "true" ]]; then
        log "Running immediate backup..."
        /scripts/backup.sh
    fi
}

# Main
main() {
    log "=========================================="
    log "Backup service starting"
    log "Schedule: ${BACKUP_SCHEDULE}"
    log "=========================================="
    
    # If command is passed, run it directly
    if [[ $# -gt 0 ]]; then
        exec "$@"
    fi
    
    setup_cron
    run_immediate
    
    log "Starting cron daemon..."
    
    # Start cron in foreground and tail the log
    crond -f -l 2 &
    
    # Follow the log file
    tail -f /var/log/backup.log
}

main "$@"
