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

# Install all dependencies (dev dependencies are required for the NestJS TS build)
RUN pnpm install --frozen-lockfile

# Build the API 
RUN pnpm --filter @meatsoko/api build

# Clean install of ONLY production dependencies. 
# We removed the invalid --non-interactive flag here.
RUN pnpm install --prod --frozen-lockfile

# Cloud Run defaults to port 8080
EXPOSE 8080

# Move execution context into the API directory
WORKDIR /app/apps/api

# Execute the compiled NestJS binary
CMD ["node", "dist/main.js"]