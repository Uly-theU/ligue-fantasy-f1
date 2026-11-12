#!/bin/sh
set -eu
printenv | grep -E '^(CRON_SECRET|BASE_URL)=' | sed 's/^/export /' > /etc/cron.env
exec crond -f -l 2
