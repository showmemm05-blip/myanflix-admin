# ---- deps stage -------------------------------------------------------------
FROM node:26-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder stage -----------------------------------------------------------
FROM node:26-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars get inlined into the client-side JS bundle at build
# time, not read at container start — has to be supplied here as a build
# arg, unlike a normal runtime env var.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Feature flag for direct browser->MinIO uploads (see
# lib/context/bulk-upload-context.tsx) — defaults off. Flip via
# NEXT_PUBLIC_USE_DIRECT_MINIO_UPLOAD=true at build time, then rebuild +
# redeploy this image; that's the entire rollback/roll-forward mechanism,
# no backend change needed either way.
ARG NEXT_PUBLIC_USE_DIRECT_MINIO_UPLOAD
ENV NEXT_PUBLIC_USE_DIRECT_MINIO_UPLOAD=$NEXT_PUBLIC_USE_DIRECT_MINIO_UPLOAD

RUN npm run build

# ---- runner stage -----------------------------------------------------------
FROM node:26-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN useradd --system --uid 1001 nextjs

# `output: "standalone"` (next.config.ts) traces only the node_modules this
# app actually uses into .next/standalone — that plus .next/static and
# public/ is everything needed to run, no full node_modules copy required.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs

ENV PORT=3002
ENV HOSTNAME=0.0.0.0
EXPOSE 3002

CMD ["node", "server.js"]
