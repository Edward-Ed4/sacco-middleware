FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY apps/dashboard/package.json ./apps/dashboard/

RUN npm install --workspace=apps/dashboard

COPY apps/dashboard/ ./apps/dashboard/

EXPOSE 3003

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3003/health || exit 1

CMD ["node", "apps/dashboard/src/index.js"]
