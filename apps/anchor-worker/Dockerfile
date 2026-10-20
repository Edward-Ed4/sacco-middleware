FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/anchor-worker/package.json ./apps/anchor-worker/

RUN npm install --workspace=packages/shared --workspace=apps/anchor-worker

COPY packages/shared/ ./packages/shared/
COPY apps/anchor-worker/ ./apps/anchor-worker/

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "apps/anchor-worker/src/index.js"]
