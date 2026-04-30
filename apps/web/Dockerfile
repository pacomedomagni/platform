FROM node:20 AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
COPY .npmrc* ./

# Install dependencies. See apps/api/Dockerfile for the rationale on
# `npm ci` + retry-tuning — same registry-flakiness mitigation.
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm ci

ENV NX_DAEMON=false
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js 16 evaluates next.config.js `rewrites()` at build time, so the
# proxy destination for /api/* gets baked into the standalone output.
# The default in next.config.js is http://localhost:3000 (correct for
# `nx serve web` on the developer host); when building inside docker we
# need the API container's network hostname instead. Compose passes
# this as a build arg.
ARG API_INTERNAL_URL=http://noslag_api:3000
ENV API_INTERNAL_URL=$API_INTERNAL_URL

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
