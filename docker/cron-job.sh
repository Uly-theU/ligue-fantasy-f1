#!/bin/sh
set -eu
BASE_URL="${BASE_URL:-http://app:3000}"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET manquant" >&2
  exit 1
fi

curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" "${BASE_URL}$1"
echo
