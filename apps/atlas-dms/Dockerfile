,FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY apps/atlas-dms/package.json apps/atlas-dms/
RUN npm ci --workspace=@atlas/dms --workspace=@atlas/core --workspace=@atlas/server-common
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY apps/atlas-dms/ apps/atlas-dms/
USER node
EXPOSE 4001
CMD ["npx", "tsx", "apps/atlas-dms/src/index.ts"]
