FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/atlas-gui/package.json apps/atlas-gui/

ENV HUSKY=0
RUN npm ci --workspace=@atlas/gui

COPY packages/core/ packages/core/
COPY apps/atlas-gui/ apps/atlas-gui/

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DMS_URL
ARG NEXT_PUBLIC_SCHEDULER_URL
ARG NEXT_PUBLIC_NOTIFY_URL
ARG NEXT_PUBLIC_NOTES_URL
ARG NEXT_PUBLIC_TRACKER_URL
ARG NEXT_PUBLIC_OIDC_AUTHORITY
ARG NEXT_PUBLIC_OIDC_CLIENT_ID
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN npm -w @atlas/gui run build

FROM node:22-alpine

LABEL org.opencontainers.image.source="https://github.com/xaverric/atlas-lab"
LABEL org.opencontainers.image.description="Atlas Lab — atlas-gui (Next.js)"
LABEL org.opencontainers.image.vendor="xaverric"
LABEL org.opencontainers.image.licenses="UNLICENSED"

ARG CACHE_BUST
# Patch OS vulnerabilities + CIS 4.8 — remove SUID/SGID binaries
RUN apk upgrade --no-cache && npm install -g npm@latest && find / -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true

WORKDIR /app

COPY --from=builder /app/apps/atlas-gui/.next/standalone ./
COPY --from=builder /app/apps/atlas-gui/.next/static apps/atlas-gui/.next/static
COPY --from=builder /app/apps/atlas-gui/public apps/atlas-gui/public

ENV NODE_ENV=production

# CIS 4.1 — non-root user
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/atlas-gui/server.js"]
