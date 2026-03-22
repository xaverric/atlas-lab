FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY apps/atlas-dms/package.json apps/atlas-dms/
RUN npm ci --workspace=@atlas/dms
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY apps/atlas-dms/ apps/atlas-dms/
RUN npm -w @atlas/dms run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/packages/server-common/dist packages/server-common/dist
COPY --from=builder /app/packages/server-common/package.json packages/server-common/
COPY --from=builder /app/apps/atlas-dms/dist apps/atlas-dms/dist
COPY --from=builder /app/apps/atlas-dms/package.json apps/atlas-dms/
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --workspace=@atlas/dms --omit=dev
USER node
EXPOSE 4001
CMD ["node", "apps/atlas-dms/dist/index.js"]
