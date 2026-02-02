FROM node:20 AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
COPY .npmrc* ./

# Install dependencies
RUN npm install

ENV NX_DAEMON=false

# Copy source code
COPY . .

# Build the Web App
RUN npx nx build web --configuration=production

# --- Production Stage ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# Copy built artifacts from builder
# Next.js via Nx output is usually in dist/apps/web
COPY --from=builder /app/dist/apps/web/public ./public
COPY --from=builder /app/dist/apps/web/.next ./.next
COPY --from=builder /app/dist/apps/web/package.json ./package.json

# Install production dependencies (Next.js needs them to run the server)
RUN npm install --omit=dev

EXPOSE 3000

CMD ["npm", "start"]
