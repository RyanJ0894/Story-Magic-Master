#!/bin/bash
set -e

echo "==> Installing Git LFS..."
curl -sL https://github.com/git-lfs/git-lfs/releases/download/v3.4.0/git-lfs-linux-amd64-v3.4.0.tar.gz | tar xz
./git-lfs-3.4.0/git-lfs install --force
./git-lfs-3.4.0/git-lfs pull
echo "==> Git LFS files pulled successfully"

echo "==> Setting up pnpm..."
corepack enable
corepack prepare pnpm@latest --activate

echo "==> Installing dependencies..."
pnpm install

echo "==> Building..."
pnpm build

echo "==> Build complete!"
