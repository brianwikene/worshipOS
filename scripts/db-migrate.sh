#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://worship:worship@127.0.0.1:5432/worshipos}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Running migrations against ${DB_URL}"

shopt -s nullglob
for migration in "${ROOT_DIR}"/migrations/*.sql; do
	echo "Applying $(basename "${migration}")"
	psql "${DB_URL}" -f "${migration}"
done
echo "Migrations complete."
