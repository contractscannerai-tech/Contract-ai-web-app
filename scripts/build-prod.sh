#!/bin/bash
set -e

echo "[build-prod] Building React frontend..."
# PORT and BASE_PATH are required by vite.config.ts at build time
export PORT=22926
export BASE_PATH=/
export NODE_ENV=production
pnpm --filter @workspace/contract-ai run build

echo "[build-prod] Building API server..."
pnpm --filter @workspace/api-server run build

echo "[build-prod] Done."
