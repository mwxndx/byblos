# Multi-stage build for React frontend
# Switching to node:20-slim (Debian) for better support of native modules like canvas during build
FROM node:22-slim AS base

# Dependencies stage
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    libcairo2-dev \
    libgif-dev \
    libjpeg-dev \
    libpango1.0-dev \
    librsvg2-dev \
    make \
    pkg-config \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=2048"
COPY package*.json ./
# Install all dependencies using lockfile for 100% deterministic builds
RUN npm ci

# Build stage
FROM deps AS builder
WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=2048"
COPY . .
RUN npm run build

# Production stage
FROM nginxinc/nginx-unprivileged:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
