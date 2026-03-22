FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server-common/package.json packages/server-common/
COPY apps/atlas-tracker/package.json apps/atlas-tracker/
RUN npm ci --workspace=@atlas/tracker --workspace=@atlas/core --workspace=@atlas/server-common
COPY packages/core/ packages/core/
COPY packages/server-common/ packages/server-common/
COPY apps/atlas-tracker/ apps/atlas-tracker/
USER node
EXPOSE 4006
CMD ["npx", "tsx", "apps/atlas-tracker/src/index.ts"]
