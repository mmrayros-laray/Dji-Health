#!/usr/bin/env bash
# Applies migrations + seed to a database and runs the RLS / security checks.
#   With a running Supabase stack:   DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
#   Without Docker (plain Postgres): STUB=1 DB_URL=postgresql://... npm run test:db   (creates a throwaway DB)
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DB_URL:?set DB_URL}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

if [[ "${STUB:-0}" == "1" ]]; then
  ADMIN_URL="$DB_URL"
  "${PSQL[@]}" "$ADMIN_URL" -c "drop database if exists djihealth_test" -c "create database djihealth_test"
  DB_URL="${ADMIN_URL%/*}/djihealth_test"
  "${PSQL[@]}" "$DB_URL" -f supabase/tests/stub_supabase.sql
  for f in supabase/migrations/*.sql; do echo "→ $f"; "${PSQL[@]}" "$DB_URL" -f "$f"; done
  echo "→ supabase/seed.sql"; "${PSQL[@]}" "$DB_URL" -f supabase/seed.sql
fi

for f in supabase/tests/checks/*.sql; do
  echo "▶ $f"
  "${PSQL[@]}" "$DB_URL" -f "$f"
done
echo "✔ all database checks passed"
