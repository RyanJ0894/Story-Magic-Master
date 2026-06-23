# ─── Build stage ─────────────────────────────────────────────────────────────
# node:22-bookworm gives us a full Debian Bookworm environment with apt-get,
# which is needed to install cmake and the libav dev headers for building
# whisper.cpp with -DWHISPER_FFMPEG=ON (enables resampling of any sample rate).
FROM node:22-bookworm AS builder

RUN apt-get update -q && apt-get install -y --no-install-recommends \
    cmake \
    git \
    pkg-config \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswresample-dev \
    libasound2-dev \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9.1.0

WORKDIR /app

# Copy workspace manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/orchestrator/package.json ./packages/orchestrator/
COPY packages/web/package.json ./packages/web/
# Schema must be present before pnpm install — packages/web postinstall runs
# prisma generate, which needs the schema file.
COPY packages/shared/prisma ./packages/shared/prisma/

RUN pnpm install --frozen-lockfile

# Copy full source after deps are installed.
COPY . .

# Build whisper.cpp. PROJECT_ROOT=/app overrides the Render-specific default
# (/opt/render/project/src) so the binary lands at /app/bin/whisper and the
# model at /app/.whisper-models/ggml-base.en.bin.
RUN PROJECT_ROOT=/app bash scripts/install-whisper.sh

# Generate Prisma client and compile TypeScript.
RUN pnpm --filter @story-magic/shared exec prisma generate && \
    pnpm --filter @story-magic/orchestrator build

# ─── Runtime stage ────────────────────────────────────────────────────────────
# node:22-bookworm-slim for a smaller image.
#   ffmpeg  — pulls in all libav* runtime libs the whisper binary links against
#   curl    — used by Doppler install and the health check
FROM node:22-bookworm-slim AS runtime

RUN apt-get update -q && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Install Doppler CLI — used in the startCommand to inject secrets at runtime.
RUN curl -fsSL -o /tmp/doppler.tgz https://github.com/DopplerHQ/cli/releases/download/3.76.0/doppler_3.76.0_linux_amd64.tar.gz && \
    echo "04f1ff30ed162d7af1dba7f11ad6a37ef35099de86a7ec6e261b64b1b337a3f3  /tmp/doppler.tgz" | sha256sum -c - && \
    tar --overwrite -xzf /tmp/doppler.tgz -C /usr/local/bin doppler && \
    rm /tmp/doppler.tgz

RUN npm install -g pnpm@9.1.0

WORKDIR /app

# Brings across: node_modules, dist, knowledge_bases, catalog, scripts,
# whisper binary (/app/bin/whisper), whisper model (/app/.whisper-models/),
# package.json files, and the Prisma-generated client.
COPY --from=builder /app ./

ENV PORT=22002
EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Doppler injects secrets via DOPPLER_TOKEN (set in Render env vars).
# Env check runs before start to catch misconfiguration early.
CMD ["doppler", "run", "--", "sh", "-c", "node scripts/check-env-orchestrator.js && pnpm --filter @story-magic/orchestrator start"]
