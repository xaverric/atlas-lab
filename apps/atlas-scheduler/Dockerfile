FROM node:22-alpine

LABEL org.opencontainers.image.source="https://github.com/xaverric/atlas-lab"
LABEL org.opencontainers.image.description="Atlas Lab — atlas-scheduler"
LABEL org.opencontainers.image.vendor="xaverric"
LABEL org.opencontainers.image.licenses="UNLICENSED"

ARG CACHE_BUST
RUN apk upgrade --no-cache && apk add --no-cache docker-cli && npm install -g npm@latest && find / -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY packages/event-bus/package.json packages/event-bus/
COPY apps/atlas-scheduler/package.json apps/atlas-scheduler/

ENV HUSKY=0
RUN npm ci --workspace=@atlas/scheduler --workspace=@atlas/core --workspace=@atlas/server-common --workspace=@atlas/event-bus \
    && npm cache clean --force && rm -rf /tmp/*

COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY packages/event-bus/ packages/event-bus/
COPY apps/atlas-scheduler/ apps/atlas-scheduler/

ENV NODE_ENV=production
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4002/health || exit 1

EXPOSE 4002
CMD ["npx", "tsx", "apps/atlas-scheduler/src/index.ts"]
