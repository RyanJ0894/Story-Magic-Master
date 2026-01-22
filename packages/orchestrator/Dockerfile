# Story Magic Orchestrator
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install system dependencies (ffmpeg for audio processing)
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy built code from builder
COPY --from=builder /app/dist ./dist

# Copy knowledge bases and catalog
COPY knowledge_bases ./knowledge_bases
COPY catalog ./catalog

# Create output directory
RUN mkdir -p /app/output

# Expose port
EXPOSE 22002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:22002/health || exit 1

# Run the application
CMD ["node", "dist/index.js"]
