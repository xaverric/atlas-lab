FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/xaverric/atlas-lab"
LABEL org.opencontainers.image.description="Atlas Lab — atlas-core"
LABEL org.opencontainers.image.vendor="xaverric"
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY apps/atlas-core/package.json apps/atlas-core/
RUN npm ci --workspace=@atlas/server --workspace=@atlas/core --workspace=@atlas/server-common
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY apps/atlas-core/ apps/atlas-core/
USER node
EXPOSE 4000
CMD ["npx", "tsx", "apps/atlas-core/src/index.ts"]
