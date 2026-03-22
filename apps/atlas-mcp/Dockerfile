FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/xaverric/atlas-lab"
LABEL org.opencontainers.image.description="Atlas Lab — atlas-mcp"
LABEL org.opencontainers.image.vendor="xaverric"
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY apps/atlas-mcp/package.json apps/atlas-mcp/
RUN npm ci --workspace=@atlas/mcp --workspace=@atlas/core --workspace=@atlas/server-common
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY apps/atlas-mcp/ apps/atlas-mcp/
USER node
EXPOSE 4005
CMD ["npx", "tsx", "apps/atlas-mcp/src/index.ts"]
