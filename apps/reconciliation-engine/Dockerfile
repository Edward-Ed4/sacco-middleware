FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/reconciliation-engine/package.json ./apps/reconciliation-engine/

RUN npm install --workspace=packages/shared --workspace=apps/reconciliation-engine

COPY packages/shared/ ./packages/shared/
COPY apps/reconciliation-engine/ ./apps/reconciliation-engine/

EXPOSE 9091

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:9091/health || exit 1

CMD ["node", "apps/reconciliation-engine/src/index.js"]
