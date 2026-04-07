FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/
COPY packages/shared/package.json ./packages/shared/

RUN npm install --workspace=packages/shared --workspace=frontend 2>/dev/null || npm install

COPY packages/shared ./packages/shared
COPY frontend ./frontend

WORKDIR /app/frontend

EXPOSE 5173

CMD ["npx", "vite", "--host", "0.0.0.0"]
