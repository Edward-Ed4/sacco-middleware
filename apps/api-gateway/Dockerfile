FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api-gateway/package.json ./apps/api-gateway/

RUN npm install --workspace=packages/shared --workspace=apps/api-gateway

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/api-gateway/ ./apps/api-gateway/

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/ready || exit 1

CMD ["node", "apps/api-gateway/src/index.js"]
