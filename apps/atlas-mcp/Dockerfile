FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY apps/atlas-mcp/package.json apps/atlas-mcp/
RUN npm ci --workspace=@atlas/mcp
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY apps/atlas-mcp/ apps/atlas-mcp/
RUN npm -w @atlas/mcp run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/packages/server-common/dist packages/server-common/dist
COPY --from=builder /app/packages/server-common/package.json packages/server-common/
COPY --from=builder /app/apps/atlas-mcp/dist apps/atlas-mcp/dist
COPY --from=builder /app/apps/atlas-mcp/package.json apps/atlas-mcp/
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --workspace=@atlas/mcp --omit=dev
EXPOSE 4005
CMD ["node", "apps/atlas-mcp/dist/index.js"]
