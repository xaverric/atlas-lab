FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/xaverric/atlas-lab"
LABEL org.opencontainers.image.description="Atlas Lab — atlas-tracker"
LABEL org.opencontainers.image.vendor="xaverric"
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY apps/atlas-tracker/package.json apps/atlas-tracker/
RUN npm ci --workspace=@atlas/tracker --workspace=@atlas/core --workspace=@atlas/server-common
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY apps/atlas-tracker/ apps/atlas-tracker/
USER node
EXPOSE 4006
CMD ["npx", "tsx", "apps/atlas-tracker/src/index.ts"]
