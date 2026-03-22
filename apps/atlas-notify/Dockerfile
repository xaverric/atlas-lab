FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/xaverric/atlas-lab"
LABEL org.opencontainers.image.description="Atlas Lab — atlas-notify"
LABEL org.opencontainers.image.vendor="xaverric"
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY packages/event-bus/package.json packages/event-bus/
COPY apps/atlas-notify/package.json apps/atlas-notify/
RUN npm ci --workspace=@atlas/notify --workspace=@atlas/core --workspace=@atlas/server-common --workspace=@atlas/event-bus
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY packages/event-bus/ packages/event-bus/
COPY apps/atlas-notify/ apps/atlas-notify/
USER node
EXPOSE 4003
CMD ["npx", "tsx", "apps/atlas-notify/src/index.ts"]
