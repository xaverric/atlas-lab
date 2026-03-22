FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY packages/event-bus/package.json packages/event-bus/
COPY apps/atlas-notify/package.json apps/atlas-notify/
RUN npm ci --workspace=@atlas/notify
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY packages/event-bus/ packages/event-bus/
COPY apps/atlas-notify/ apps/atlas-notify/
RUN npm -w @atlas/notify run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/packages/server-common/dist packages/server-common/dist
COPY --from=builder /app/packages/server-common/package.json packages/server-common/
COPY --from=builder /app/packages/event-bus/dist packages/event-bus/dist
COPY --from=builder /app/packages/event-bus/package.json packages/event-bus/
COPY --from=builder /app/apps/atlas-notify/dist apps/atlas-notify/dist
COPY --from=builder /app/apps/atlas-notify/package.json apps/atlas-notify/
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --workspace=@atlas/notify --omit=dev
USER node
EXPOSE 4003
CMD ["node", "apps/atlas-notify/dist/index.js"]
