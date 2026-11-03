#!/usr/bin/env bash
# Start the Vite dev server at http://localhost:5173 (proxies /api to Django :8000).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm install
exec npm run dev
