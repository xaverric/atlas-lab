FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/atlas-gui/package.json apps/atlas-gui/
RUN npm ci --workspace=@atlas/gui
COPY packages/core/ packages/core/
COPY apps/atlas-gui/ apps/atlas-gui/
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_OIDC_AUTHORITY
ARG NEXT_PUBLIC_OIDC_CLIENT_ID
RUN npm -w @atlas/gui run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/apps/atlas-gui/.next/standalone ./
COPY --from=builder /app/apps/atlas-gui/.next/static apps/atlas-gui/.next/static
COPY --from=builder /app/apps/atlas-gui/public apps/atlas-gui/public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/atlas-gui/server.js"]
