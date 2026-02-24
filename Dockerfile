# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline


# ── Stage 2: Build Next.js ─────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_API_URL is baked in at build time.
# Pass it as a build arg from Railway's environment variables.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Ensure public/ exists so the COPY in the runner stage never fails
RUN mkdir -p public && npm run build


# ── Stage 3: Minimal runtime ───────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# public/ is optional — create an empty one if it doesn't exist in the build
RUN mkdir -p ./public
COPY --from=builder /app/public/ ./public/

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
