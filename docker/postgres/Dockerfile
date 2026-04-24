# Use PostGIS as base image
FROM postgis/postgis:15-3.3-alpine

# Install build dependencies and pgvector
RUN apk add --no-cache --virtual .build-deps \
    git \
    build-base \
    postgresql-dev \
    clang15 \
    llvm15 \
    && git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && cd /tmp/pgvector \
    && make \
    && make install \
    && cd / \
    && rm -rf /tmp/pgvector \
    && apk del .build-deps

# Copy initialization script
COPY init.sql /docker-entrypoint-initdb.d/
