#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
cd "$root"
[[ -f .env ]] || { echo 'Copy .env.example to .env.' >&2; exit 1; }
[[ -d backend/node_modules && -d frontend/node_modules ]] || { echo 'Run scripts/bootstrap.sh.' >&2; exit 1; }
set -a; source .env; set +a
: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY is required}" "${OPENROUTER_MODEL:?OPENROUTER_MODEL is required}"
[[ "${OPENROUTER_BASE_URL:-${OPENAI_BASE_URL:-}}" == "https://openrouter.ai/api/v1" ]] || { echo 'OPENROUTER_BASE_URL must be https://openrouter.ai/api/v1.' >&2; exit 1; }
backend_port="$(sed -n 's/^BACKEND_PORT=//p' .env | tail -n 1 | tr -d '\r')"
frontend_port="$(sed -n 's/^FRONTEND_PORT=//p' .env | tail -n 1 | tr -d '\r')"
[[ "$backend_port" =~ ^[0-9]+$ ]] || backend_port=3501
[[ "$frontend_port" =~ ^[0-9]+$ ]] || frontend_port=3000
for port in "$backend_port" "$frontend_port"; do lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && { echo "Port $port is occupied." >&2; exit 1; } || true; done
node --env-file=.env backend/src/scripts/migrate.js
node --env-file=.env backend/src/scripts/create-admin.js
BACKEND_PORT="$backend_port" PORT="$backend_port" node --env-file=.env backend/src/server.js & b=$!
(cd frontend && BROWSER=none PORT="$frontend_port" REACT_APP_API_URL="http://127.0.0.1:$backend_port/api" \
  node --env-file=../.env node_modules/react-scripts/bin/react-scripts.js start) & f=$!
cleanup(){ kill "$b" "$f" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
wait "$b" "$f"
