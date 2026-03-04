FROM node:20 AS builder

WORKDIR /app

# Copy package configuration
COPY package*.json ./
COPY .npmrc* ./

# Install all dependencies (dev needed for build)
RUN npm install

ENV NX_DAEMON=false

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the API
RUN npx nx build api --configuration=production

# Note: We keep full node_modules because npm prune can break hoisted deps
# in monorepo setups. The webpack bundle handles tree-shaking for code.

# --- Production Stage ---
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy pruned node_modules from builder (has all runtime deps)
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema and regenerate client for Alpine native binaries
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
RUN npx prisma generate

# Copy built artifact
COPY --from=builder /app/dist/apps/api ./dist/apps/api

# Run as non-root user
USER node

EXPOSE 3000

CMD ["node", "dist/apps/api/main.js"]
