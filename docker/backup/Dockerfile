FROM alpine:3.19

# Install required packages
RUN apk add --no-cache \
    postgresql16-client \
    aws-cli \
    bash \
    gzip \
    openssl \
    curl \
    tzdata

# Set timezone
ENV TZ=UTC

# Create backup directories
RUN mkdir -p /backups /scripts

# Copy scripts
COPY backup.sh /scripts/backup.sh
COPY restore.sh /scripts/restore.sh
COPY entrypoint.sh /scripts/entrypoint.sh

# Make scripts executable
RUN chmod +x /scripts/*.sh

# Set working directory
WORKDIR /scripts

# Default command runs the backup on a schedule
ENTRYPOINT ["/scripts/entrypoint.sh"]
