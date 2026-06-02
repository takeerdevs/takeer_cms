#!/bin/sh
set -eu

password="$(cat "$PGBOUNCER_PASSWORD_FILE")"

exec /bin/pgbouncer_exporter \
    --pgBouncer.connectionString="postgres://${PGBOUNCER_USER}:${password}@${PGBOUNCER_HOST}:${PGBOUNCER_PORT}/pgbouncer?sslmode=disable"
