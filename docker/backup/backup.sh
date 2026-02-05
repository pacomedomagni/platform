#!/bin/bash
set -euo pipefail

# ============================================
# Database Backup Script
# ============================================
# Creates a compressed, encrypted backup of the PostgreSQL database
# and uploads it to S3-compatible storage (MinIO or AWS S3)
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

BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Derived variables
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
BACKUP_FILE="backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

# Check required environment variables
check_requirements() {
    if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
        error "POSTGRES_PASSWORD is required"
        exit 1
    fi
    
    if [[ -z "${S3_BUCKET:-}" ]]; then
        error "S3_BUCKET is required"
        exit 1
    fi
}

# Create the database backup
create_backup() {
    log "Starting backup of database: ${POSTGRES_DB}"
    
    export PGPASSWORD="${POSTGRES_PASSWORD}"
    
    # Create backup with pg_dump
    pg_dump \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        --format=plain \
        --no-owner \
        --no-privileges \
        --verbose \
        2>&1 | gzip > "${BACKUP_PATH}"
    
    local backup_size=$(du -h "${BACKUP_PATH}" | cut -f1)
    log "Backup created: ${BACKUP_PATH} (${backup_size})"
}

# Encrypt backup (optional)
encrypt_backup() {
    if [[ -n "${ENCRYPTION_KEY}" ]]; then
        log "Encrypting backup..."
        openssl enc -aes-256-cbc -salt -pbkdf2 \
            -in "${BACKUP_PATH}" \
            -out "${BACKUP_PATH}.enc" \
            -pass pass:"${ENCRYPTION_KEY}"
        rm "${BACKUP_PATH}"
        BACKUP_PATH="${BACKUP_PATH}.enc"
        BACKUP_FILE="${BACKUP_FILE}.enc"
        log "Backup encrypted"
    fi
}

# Upload to S3
upload_to_s3() {
    log "Uploading backup to S3: s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}"
    
    local aws_args=""
    if [[ -n "${S3_ENDPOINT}" ]]; then
        aws_args="--endpoint-url ${S3_ENDPOINT}"
    fi
    
    # Create bucket if it doesn't exist (for MinIO)
    aws s3 mb "s3://${S3_BUCKET}" ${aws_args} 2>/dev/null || true
    
    # Upload backup
    aws s3 cp \
        "${BACKUP_PATH}" \
        "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}" \
        ${aws_args} \
        --storage-class STANDARD_IA
    
    log "Upload complete"
}

# Clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."
    
    local aws_args=""
    if [[ -n "${S3_ENDPOINT}" ]]; then
        aws_args="--endpoint-url ${S3_ENDPOINT}"
    fi
    
    # Calculate cutoff date
    local cutoff_date=$(date -d "-${BACKUP_RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || \
                        date -v-${BACKUP_RETENTION_DAYS}d +%Y-%m-%d)
    
    # List and delete old backups
    aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" ${aws_args} | while read -r line; do
        local file_date=$(echo "$line" | awk '{print $1}')
        local file_name=$(echo "$line" | awk '{print $4}')
        
        if [[ "${file_date}" < "${cutoff_date}" ]] && [[ -n "${file_name}" ]]; then
            log "Deleting old backup: ${file_name}"
            aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${file_name}" ${aws_args}
        fi
    done
    
    # Clean up local backups
    find "${BACKUP_DIR}" -type f -mtime +7 -delete 2>/dev/null || true
    
    log "Cleanup complete"
}

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."
    
    if [[ "${BACKUP_FILE}" == *.enc ]]; then
        # For encrypted backups, just check file exists and has content
        if [[ -s "${BACKUP_PATH}" ]]; then
            log "Encrypted backup verified (file exists and has content)"
        else
            error "Backup file is empty or missing"
            return 1
        fi
    else
        # For unencrypted backups, verify gzip integrity
        if gzip -t "${BACKUP_PATH}" 2>/dev/null; then
            log "Backup verified (gzip integrity check passed)"
        else
            error "Backup integrity check failed"
            return 1
        fi
    fi
}

# Send notification (optional)
send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -s -X POST "${SLACK_WEBHOOK_URL}" \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"[Backup ${status}] ${message}\"}" \
            >/dev/null 2>&1 || true
    fi
}

# Main execution
main() {
    log "=========================================="
    log "Starting backup process"
    log "=========================================="
    
    check_requirements
    
    # Create backup
    if ! create_backup; then
        error "Backup creation failed"
        send_notification "FAILED" "Database backup creation failed for ${POSTGRES_DB}"
        exit 1
    fi
    
    # Encrypt (if key provided)
    encrypt_backup
    
    # Verify backup
    if ! verify_backup; then
        error "Backup verification failed"
        send_notification "FAILED" "Backup verification failed for ${POSTGRES_DB}"
        exit 1
    fi
    
    # Upload to S3
    if ! upload_to_s3; then
        error "S3 upload failed"
        send_notification "FAILED" "Backup upload failed for ${POSTGRES_DB}"
        exit 1
    fi
    
    # Cleanup old backups
    cleanup_old_backups
    
    local backup_size=$(du -h "${BACKUP_PATH}" | cut -f1)
    log "=========================================="
    log "Backup completed successfully"
    log "File: ${BACKUP_FILE}"
    log "Size: ${backup_size}"
    log "=========================================="
    
    send_notification "SUCCESS" "Database backup completed: ${BACKUP_FILE} (${backup_size})"
}

# Run main
main "$@"
