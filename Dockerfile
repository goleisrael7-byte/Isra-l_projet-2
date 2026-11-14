FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["npx", "tsx", "server.ts"]
