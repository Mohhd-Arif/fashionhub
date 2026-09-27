FROM node:22-bookworm-slim AS frontend

WORKDIR /app/FHUB_ui
COPY FHUB_ui/package.json FHUB_ui/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY FHUB_ui/ ./
RUN npm run build

FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app/FHUB_be
COPY FHUB_be/package.json FHUB_be/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --chown=node:node FHUB_be/ ./
COPY --from=frontend --chown=node:node /app/FHUB_ui/dist ./dist

USER node
EXPOSE 8080
CMD ["node", "index.js"]
