FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY apps/atlas-notes/package.json apps/atlas-notes/
RUN npm ci --workspace=@atlas/notes
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY apps/atlas-notes/ apps/atlas-notes/
RUN npm -w @atlas/notes run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/packages/server-common/dist packages/server-common/dist
COPY --from=builder /app/packages/server-common/package.json packages/server-common/
COPY --from=builder /app/apps/atlas-notes/dist apps/atlas-notes/dist
COPY --from=builder /app/apps/atlas-notes/package.json apps/atlas-notes/
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --workspace=@atlas/notes --omit=dev
USER node
EXPOSE 4004
CMD ["node", "apps/atlas-notes/dist/index.js"]
