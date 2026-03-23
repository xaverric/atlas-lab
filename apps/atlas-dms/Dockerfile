FROM node:22-alpine

LABEL org.opencontainers.image.source="https://github.com/xaverric/atlas-lab"
LABEL org.opencontainers.image.description="Atlas Lab — atlas-dms"
LABEL org.opencontainers.image.vendor="xaverric"
LABEL org.opencontainers.image.licenses="UNLICENSED"

RUN apk upgrade --no-cache && npm install -g npm@latest && find / -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY apps/atlas-dms/package.json apps/atlas-dms/

ENV HUSKY=0
RUN npm ci --workspace=@atlas/dms --workspace=@atlas/core --workspace=@atlas/server-common \
    && npm cache clean --force && rm -rf /tmp/*

COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY apps/atlas-dms/ apps/atlas-dms/

ENV NODE_ENV=production
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4001/health || exit 1

EXPOSE 4001
CMD ["npx", "tsx", "apps/atlas-dms/src/index.ts"]
