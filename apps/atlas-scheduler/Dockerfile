FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY packages/event-bus/package.json packages/event-bus/
COPY apps/atlas-scheduler/package.json apps/atlas-scheduler/
RUN npm ci --workspace=@atlas/scheduler --workspace=@atlas/core --workspace=@atlas/server-common --workspace=@atlas/event-bus
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY packages/event-bus/ packages/event-bus/
COPY apps/atlas-scheduler/ apps/atlas-scheduler/
USER node
EXPOSE 4002
CMD ["npx", "tsx", "apps/atlas-scheduler/src/index.ts"]
