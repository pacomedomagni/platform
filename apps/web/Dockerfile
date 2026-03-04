FROM node:20 AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
COPY .npmrc* ./

# Install dependencies
RUN npm install

ENV NX_DAEMON=false
ENV NEXT_TELEMETRY_DISABLED=1

# Copy source code
COPY . .

# Build the Web App
RUN npx nx build web --configuration=production

# --- Production Stage ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy public assets
COPY --from=builder /app/apps/web/public ./public

# Copy Next.js standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Run as non-root user
USER node

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
