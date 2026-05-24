# ─── Build stage ───────────────────────────────────────────────────────────
# Builds the control plane from a pruned pnpm workspace.
# Must be built from the repo root, e.g.:
#   docker build -f packages/control-plane/Dockerfile -t relay-control-plane .

FROM node:20-alpine AS build

RUN corepack enable

WORKDIR /repo

# Workspace metadata
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/sdk/package.json   packages/sdk/
COPY packages/db/package.json    packages/db/
COPY packages/control-plane/package.json packages/control-plane/

# Install everything (workspace links resolve before sources exist)
RUN pnpm install --frozen-lockfile

# Now copy sources
COPY packages/sdk           packages/sdk
COPY packages/db            packages/db
COPY packages/control-plane packages/control-plane

# Build the deps the control-plane imports + the control plane itself
RUN pnpm --filter @relayhq/db build && \
    pnpm --filter @relayhq/control-plane build

# Prune to production deps only
RUN pnpm --filter @relayhq/control-plane deploy --prod /out

# ─── Runtime stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS run

WORKDIR /app

COPY --from=build /out/package.json ./package.json
COPY --from=build /out/dist         ./dist
COPY --from=build /out/node_modules ./node_modules

EXPOSE 4000
ENV PORT=4000 NODE_ENV=production

USER node
CMD ["node", "dist/server.js"]
