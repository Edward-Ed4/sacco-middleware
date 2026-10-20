FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/sms-verification/package.json ./apps/sms-verification/

RUN npm install --workspace=packages/shared --workspace=apps/sms-verification

COPY packages/shared/ ./packages/shared/
COPY apps/sms-verification/ ./apps/sms-verification/

EXPOSE 3002

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["node", "apps/sms-verification/src/index.js"]
