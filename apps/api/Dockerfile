FROM node:20-alpine AS builder

WORKDIR /app

# Copy package configuration
COPY package*.json ./
COPY .npmrc* ./

# Install dependencies (including dev dependencies for building)
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the API
# We assume the machine context has the Nx CLI available via npx
RUN npx nx build api --configuration=production

# --- Production Stage ---
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only (optional for optimization, but for now we keep it simple)
# In valid monorepo setups, we might just copy the node_modules from builder or prune.
# For simplicity in this Phase 1 check, we'll carry over the builder's modules 
# or reinstall only prod. Let's just reinstall prod to keep image small.
COPY package*.json ./
RUN npm install --omit=dev

# Copy Prisma schema and generate client again (needed for native binaries on Alpine)
COPY prisma ./prisma
RUN npx prisma generate

# Copy built artifact
COPY --from=builder /app/dist/apps/api ./dist/apps/api
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Validation: Check if main.js exists
RUN ls -la dist/apps/api

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "dist/apps/api/main.js"]
