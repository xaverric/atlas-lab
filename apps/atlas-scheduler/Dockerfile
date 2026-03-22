FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY packages/event-bus/package.json packages/event-bus/
COPY apps/atlas-scheduler/package.json apps/atlas-scheduler/
RUN npm ci --workspace=@atlas/scheduler
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY packages/event-bus/ packages/event-bus/
COPY apps/atlas-scheduler/ apps/atlas-scheduler/
RUN npm -w @atlas/scheduler run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/packages/server-common/dist packages/server-common/dist
COPY --from=builder /app/packages/server-common/package.json packages/server-common/
COPY --from=builder /app/packages/event-bus/dist packages/event-bus/dist
COPY --from=builder /app/packages/event-bus/package.json packages/event-bus/
COPY --from=builder /app/apps/atlas-scheduler/dist apps/atlas-scheduler/dist
COPY --from=builder /app/apps/atlas-scheduler/package.json apps/atlas-scheduler/
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --workspace=@atlas/scheduler --omit=dev
USER node
EXPOSE 4002
CMD ["node", "apps/atlas-scheduler/dist/index.js"]
