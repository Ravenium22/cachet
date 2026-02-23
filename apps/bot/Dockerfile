FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci
RUN npx turbo build --filter=@megaeth-verify/bot

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/apps/bot/package.json ./apps/bot/package.json
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist

COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist

COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

CMD ["node", "apps/bot/dist/index.js"]
