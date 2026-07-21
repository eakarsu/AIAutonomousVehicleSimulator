#!/usr/bin/env bash
set -euo pipefail
r="$(cd "$(dirname "$0")/.."&&pwd)";set -a;source "$r/.env";set +a;: "${DB_NAME:?}" "${DB_USER:?}";for m in "$r"/backend/migrations/*.sql;do PGPASSWORD="${DB_PASSWORD:-}" psql -v ON_ERROR_STOP=1 -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -f "$m";done
