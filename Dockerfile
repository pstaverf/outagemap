FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
FROM dependencies AS builder
ARG NEXT_PUBLIC_VECTOR_STYLE=https://tiles.openfreemap.org/styles/positron
ARG NEXT_PUBLIC_SATELLITE_URL
ARG NEXT_PUBLIC_MAP_ASSET_ORIGINS
ENV NEXT_PUBLIC_MAP_ASSET_ORIGINS=$NEXT_PUBLIC_MAP_ASSET_ORIGINS
ARG NEXT_PUBLIC_SATELLITE_ATTRIBUTION
ENV NEXT_PUBLIC_VECTOR_STYLE=$NEXT_PUBLIC_VECTOR_STYLE
ENV NEXT_PUBLIC_SATELLITE_URL=$NEXT_PUBLIC_SATELLITE_URL
ENV NEXT_PUBLIC_SATELLITE_ATTRIBUTION=$NEXT_PUBLIC_SATELLITE_ATTRIBUTION
COPY . .
RUN npx prisma generate
RUN npm run build
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
