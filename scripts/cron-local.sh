#!/bin/sh
# Appelle l'ingestion puis le scoring sur l'app locale.
# BASE_URL par défaut : http://127.0.0.1:3000
# CRON_SECRET doit être dans l'environnement. Ne cible pas Vercel.
set -eu

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET manquant" >&2
  exit 1
fi

curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" "${BASE_URL}/api/cron/ingest-results"
echo
curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" "${BASE_URL}/api/cron/calculate-scores"
echo
