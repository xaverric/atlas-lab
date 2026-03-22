FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY apps/atlas-notes/package.json apps/atlas-notes/
RUN npm ci --workspace=@atlas/notes --workspace=@atlas/core --workspace=@atlas/server-common
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY apps/atlas-notes/ apps/atlas-notes/
USER node
EXPOSE 4004
CMD ["npx", "tsx", "apps/atlas-notes/src/index.ts"]
