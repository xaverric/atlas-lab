FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/atlas-core/package.json apps/atlas-core/
RUN npm ci --workspace=@atlas/server
COPY packages/core/ packages/core/
COPY apps/atlas-core/ apps/atlas-core/
RUN npm -w @atlas/server run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/apps/atlas-core/dist apps/atlas-core/dist
COPY --from=builder /app/apps/atlas-core/package.json apps/atlas-core/
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --workspace=@atlas/server --omit=dev
USER node
EXPOSE 4000
CMD ["node", "apps/atlas-core/dist/index.js"]
