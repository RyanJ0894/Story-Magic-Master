# Story Magic Orchestrator
FROM node:20-slim AS builder

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --no-frozen-lockfile

# Copy application code
COPY . .

# Build TypeScript
RUN pnpm build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install system dependencies (ffmpeg for audio processing)
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# Copy package files
COPY package.json ./

# Install production dependencies only
RUN pnpm install --prod

# Copy built code from builder
COPY --from=builder /app/dist ./dist

# Copy knowledge bases and catalog
COPY knowledge_bases ./knowledge_bases
COPY catalog ./catalog

# Create output directory
RUN mkdir -p /app/output

# Expose port (default 22002 for local Docker; hosting platforms override via PORT env var)
ENV PORT=22002
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:22002/health || exit 1

# Run the application
CMD ["node", "dist/index.js"]
