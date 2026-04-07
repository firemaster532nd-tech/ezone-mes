FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
COPY packages/shared/package.json ./packages/shared/

RUN npm install --workspace=packages/shared --workspace=backend 2>/dev/null || npm install

COPY packages/shared ./packages/shared
COPY backend ./backend

WORKDIR /app/backend

CMD ["npx", "tsx", "watch", "src/index.ts"]
