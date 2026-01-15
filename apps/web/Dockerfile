# Base stage
FROM node:20-alpine AS base

# Builder stage
FROM base AS builder
WORKDIR /app
RUN npm install -g pnpm@9.0.0 turbo

# Prune the workspace to only what's needed for web
COPY . .
RUN turbo prune @agelum/web --docker

# Installer stage
FROM base AS installer
WORKDIR /app
RUN npm install -g pnpm@9.0.0

# Copy pruned files
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./
RUN pnpm install

# Build the project
COPY --from=builder /app/out/full/ .
RUN pnpm --filter @agelum/web run build:mcp

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

# Copy necessary files for running the MCP server
# We need node_modules because we are not bundling dependencies
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=installer /app/apps/web/dist-mcp ./apps/web/dist-mcp
COPY --from=installer /app/apps/web/package.json ./apps/web/package.json

# Set environment variables
ENV NODE_ENV=production

# The entrypoint runs the MCP runner
# We assume the user mounts their repo to /repo and sets WORKDIR /repo
# But we can't force WORKDIR in entrypoint if we want flexibility.
# We'll just execute the node script.
ENTRYPOINT ["node", "/app/apps/web/dist-mcp/scripts/mcp-runner.js"]
