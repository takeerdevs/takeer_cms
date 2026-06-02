#!/bin/sh
set -eu

if [ -n "${DATA_SOURCE_PASSWORD_FILE:-}" ]; then
    DATA_SOURCE_PASS="$(cat "$DATA_SOURCE_PASSWORD_FILE")"
    export DATA_SOURCE_PASS
fi

exec /bin/postgres_exporter "$@"
