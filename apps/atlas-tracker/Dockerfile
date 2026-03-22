FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY apps/atlas-tracker/package.json apps/atlas-tracker/
RUN npm ci --workspace=@atlas/tracker
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY apps/atlas-tracker/ apps/atlas-tracker/
RUN npm -w @atlas/tracker run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/packages/server-common/dist packages/server-common/dist
COPY --from=builder /app/packages/server-common/package.json packages/server-common/
COPY --from=builder /app/apps/atlas-tracker/dist apps/atlas-tracker/dist
COPY --from=builder /app/apps/atlas-tracker/package.json apps/atlas-tracker/
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --workspace=@atlas/tracker --omit=dev
USER node
EXPOSE 4006
CMD ["node", "apps/atlas-tracker/dist/index.js"]
