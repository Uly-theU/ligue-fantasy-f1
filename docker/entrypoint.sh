#!/bin/sh
set -eu

i=0
until printf 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n' | prisma db execute --stdin --schema /app/prisma/schema.prisma; do
  i=$((i + 1))
  if [ "$i" -gt 30 ]; then
    echo "Postgres injoignable" >&2
    exit 1
  fi
  sleep 2
done

prisma db push --skip-generate --schema /app/prisma/schema.prisma
exec node server.js
