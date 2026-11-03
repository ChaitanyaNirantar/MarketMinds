#!/usr/bin/env bash
# Start the Django API at http://127.0.0.1:8000 and seed the demo account.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv 2>/dev/null || true
fi

if [ -x .venv/bin/python ]; then
  PY=".venv/bin/python"
  "$PY" -m pip install -q -r requirements.txt
else
  PY="python3"
  "$PY" -m pip install -q --user -r requirements.txt
fi

"$PY" manage.py migrate
"$PY" manage.py seed_demo
echo
echo "Django API: http://127.0.0.1:8000/api/health"
echo "Demo login: you@business.com / password123"
echo
exec "$PY" manage.py runserver 8000
