FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.6.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/schemas/package.json packages/schemas/
COPY packages/core/package.json packages/core/
COPY packages/mcp-server/package.json packages/mcp-server/
RUN pnpm install --frozen-lockfile
COPY packages/schemas/ packages/schemas/
COPY packages/core/ packages/core/
COPY packages/mcp-server/ packages/mcp-server/
COPY dnas/ dnas/
RUN pnpm --filter @behavioros/mcp-server build

FROM node:22-alpine AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.6.0 --activate
COPY --from=builder /app/packages/mcp-server/dist ./dist
COPY --from=builder /app/packages/core/dist ./node_modules/@behavioros/core/dist
COPY --from=builder /app/packages/schemas/dist ./node_modules/@behavioros/schemas/dist
COPY --from=builder /app/dnas ./dnas
COPY --from=builder /app/node_modules ./node_modules
ENV BEHAVIOROS_DNA_PATH=/app/dnas/enterprise-governance.yaml
ENV BEHAVIOROS_PROJECT=behavioros
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD echo '{"jsonrpc":"2.0","id":1,"method":"resources/list","params":{}}' | node dist/server.js || exit 1
CMD ["node", "dist/server.js"]
