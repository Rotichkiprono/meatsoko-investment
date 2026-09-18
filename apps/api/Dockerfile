FROM node:24-alpine

# Install native build tools required for compiling C++ node modules
RUN apk add --no-cache python3 make g++

# Enable pnpm via corepack
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy root workspace configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy the necessary workspaces
COPY apps/api ./apps/api
COPY packages ./packages

# Suppress interactive prompts in CI/CD environments natively
ENV CI=true

# 1. Change to --no-frozen-lockfile to allow the container to resolve the new NestJS packages
RUN pnpm install --no-frozen-lockfile

# Build the API 
RUN pnpm --filter @meatsoko/api build

# 2. Also change the production prune to --no-frozen-lockfile
RUN pnpm install --prod --no-frozen-lockfile

EXPOSE 8080

WORKDIR /app/apps/api

CMD ["node", "dist/main.js"]