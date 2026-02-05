#!/bin/bash
set -euo pipefail

# ============================================
# Database Restore Script
# ============================================
# Restores a database backup from S3-compatible storage
# ============================================

# Configuration (from environment variables)
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-noslag}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
POSTGRES_DB="${POSTGRES_DB:-noslag_db}"

S3_BUCKET="${S3_BUCKET:-backups}"
S3_ENDPOINT="${S3_ENDPOINT:-}"
S3_PREFIX="${S3_PREFIX:-database}"

ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Derived variables
BACKUP_DIR="/backups"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

# List available backups
list_backups() {
    log "Available backups in s3://${S3_BUCKET}/${S3_PREFIX}/:"
    
    local aws_args=""
    if [[ -n "${S3_ENDPOINT}" ]]; then
        aws_args="--endpoint-url ${S3_ENDPOINT}"
    fi
    
    aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" ${aws_args} | sort -r | head -20
}

# Download backup from S3
download_backup() {
    local backup_file="$1"
    local local_path="${BACKUP_DIR}/${backup_file}"
    
    log "Downloading backup: ${backup_file}"
    
    local aws_args=""
    if [[ -n "${S3_ENDPOINT}" ]]; then
        aws_args="--endpoint-url ${S3_ENDPOINT}"
    fi
    
    aws s3 cp \
        "s3://${S3_BUCKET}/${S3_PREFIX}/${backup_file}" \
        "${local_path}" \
        ${aws_args}
    
    echo "${local_path}"
}

# Decrypt backup (if encrypted)
decrypt_backup() {
    local backup_path="$1"
    
    if [[ "${backup_path}" == *.enc ]]; then
        if [[ -z "${ENCRYPTION_KEY}" ]]; then
            error "Backup is encrypted but BACKUP_ENCRYPTION_KEY is not set"
            exit 1
        fi
        
        log "Decrypting backup..."
        local decrypted_path="${backup_path%.enc}"
        
        openssl enc -aes-256-cbc -d -pbkdf2 \
            -in "${backup_path}" \
            -out "${decrypted_path}" \
            -pass pass:"${ENCRYPTION_KEY}"
        
        rm "${backup_path}"
        echo "${decrypted_path}"
    else
        echo "${backup_path}"
    fi
}

# Restore database
restore_database() {
    local backup_path="$1"
    local target_db="${2:-${POSTGRES_DB}}"
    
    export PGPASSWORD="${POSTGRES_PASSWORD}"
    
    log "Restoring to database: ${target_db}"
    
    # Check if we should drop and recreate
    if [[ "${DROP_EXISTING:-false}" == "true" ]]; then
        log "Dropping existing database..."
        psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres \
            -c "DROP DATABASE IF EXISTS ${target_db};"
        psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres \
            -c "CREATE DATABASE ${target_db};"
    fi
    
    # Restore from backup
    log "Restoring data..."
    gunzip -c "${backup_path}" | psql \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${target_db}" \
        --single-transaction \
        --set ON_ERROR_STOP=on
    
    log "Restore complete"
}

# Verify restore
verify_restore() {
    local target_db="${1:-${POSTGRES_DB}}"
    
    export PGPASSWORD="${POSTGRES_PASSWORD}"
    
    log "Verifying restore..."
    
    # Check table count
    local table_count=$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${target_db}" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    
    log "Tables in database: ${table_count}"
    
    # Check record counts for key tables
    local tenant_count=$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${target_db}" \
        -t -c "SELECT COUNT(*) FROM tenants;" 2>/dev/null || echo "0")
    local user_count=$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${target_db}" \
        -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
    
    log "Tenants: ${tenant_count}, Users: ${user_count}"
}

# Show usage
usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  list                    List available backups"
    echo "  restore <backup_file>   Restore a specific backup"
    echo "  latest                  Restore the most recent backup"
    echo ""
    echo "Options:"
    echo "  --db <database>         Target database (default: ${POSTGRES_DB})"
    echo "  --drop                  Drop existing database before restore"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 restore backup_noslag_db_20240101_120000.sql.gz"
    echo "  $0 latest --drop"
}

# Main execution
main() {
    local command="${1:-}"
    shift || true
    
    case "${command}" in
        list)
            list_backups
            ;;
        
        restore)
            local backup_file="${1:-}"
            if [[ -z "${backup_file}" ]]; then
                error "Backup file name required"
                usage
                exit 1
            fi
            
            # Parse options
            shift
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --db)
                        POSTGRES_DB="$2"
                        shift 2
                        ;;
                    --drop)
                        DROP_EXISTING="true"
                        shift
                        ;;
                    *)
                        error "Unknown option: $1"
                        exit 1
                        ;;
                esac
            done
            
            local local_path=$(download_backup "${backup_file}")
            local_path=$(decrypt_backup "${local_path}")
            restore_database "${local_path}"
            verify_restore
            ;;
        
        latest)
            # Parse options
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --db)
                        POSTGRES_DB="$2"
                        shift 2
                        ;;
                    --drop)
                        DROP_EXISTING="true"
                        shift
                        ;;
                    *)
                        error "Unknown option: $1"
                        exit 1
                        ;;
                esac
            done
            
            local aws_args=""
            if [[ -n "${S3_ENDPOINT}" ]]; then
                aws_args="--endpoint-url ${S3_ENDPOINT}"
            fi
            
            local latest_backup=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" ${aws_args} | sort -r | head -1 | awk '{print $4}')
            
            if [[ -z "${latest_backup}" ]]; then
                error "No backups found"
                exit 1
            fi
            
            log "Latest backup: ${latest_backup}"
            
            local local_path=$(download_backup "${latest_backup}")
            local_path=$(decrypt_backup "${local_path}")
            restore_database "${local_path}"
            verify_restore
            ;;
        
        *)
            usage
            exit 1
            ;;
    esac
}

# Run main
main "$@"
