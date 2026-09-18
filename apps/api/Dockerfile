FROM node:24-alpine

# Install native build tools (python3, make, g++) required for compiling C++ node modules
# The --no-cache flag ensures we don't store the apk index, keeping the image small
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

# Suppress interactive prompts in CI/CD environments
ENV CI=true

# Replace "@meatsoko/api" with the EXACT "name" from apps/api/package.json
RUN pnpm --filter @meatsoko/api build

# Prune development dependencies cleanly without hanging on prompts
RUN pnpm install --prod --frozen-lockfile --non-interactive

# Cloud Run defaults to port 8080
EXPOSE 8080

WORKDIR /app/apps/api

CMD ["node", "dist/main.js"]