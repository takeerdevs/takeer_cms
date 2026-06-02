# Product-Grade Scaling Guide

This guide explains how Takeer can scale from the current local production-ish Docker setup into a product-grade deployment. The current foundation already separates the major runtime roles:

- `proxy`: owns the public HTTP port and forwards traffic to app instances.
- `app`: serves Laravel HTTP requests only.
- `queue`: runs Horizon workers for async jobs.
- `pgbouncer`: pools Postgres connections for app and queue containers.
- `postgres`: stores relational data.
- `redis`: backs cache, sessions, queues, and locks.
- `minio`: provides S3-compatible object storage locally.
- `soketi`: provides realtime websocket broadcasting.
- `/health/ready`: reports dependency readiness for load balancers.
- `/health`: provides the human-friendly health GUI.
- `/health/live`: reports process liveness.

Scheduled health history is retained for `HEALTH_SNAPSHOT_RETENTION_DAYS`, which defaults to `7`. At one sample every five minutes, that is about `2,016` rows. The health GUI only displays the latest `24` samples.

## Current Scaling Shape

The important change is that public traffic no longer goes directly to a single `app` container. Public traffic enters through `proxy`, and `app` only exposes its internal HTTP port on the Docker network.

```text
Browser / API client
        |
        v
proxy :8000
        |
        v
app replicas :80
        |
        +--> PgBouncer
        |       |
        |       +--> Postgres
        +--> Redis
        +--> MinIO
        +--> Soketi
```

This makes `app` horizontally scalable because each replica can be identical, stateless from the HTTP layer's point of view, and reachable behind the proxy.

## Multi-Server Production Target

The production goal is that adding capacity is repeatable:

```text
1. Provision a new app server.
2. Install Docker and the deployment files.
3. Set the required environment values and secrets.
4. Start the app/queue containers.
5. Wait for `/health/ready` to pass.
6. Add the server to the load balancer pool.
```

At that point, traffic can move to the new server without special application changes.

The target topology looks like this:

```text
Internet
   |
   v
Production load balancer
   |
   +--> app-server-1
   |       +--> proxy
   |       +--> app replica(s)
   |       +--> optional queue replica(s)
   |
   +--> app-server-2
   |       +--> proxy
   |       +--> app replica(s)
   |       +--> optional queue replica(s)
   |
   +--> app-server-N
           +--> proxy
           +--> app replica(s)
           +--> optional queue replica(s)

Shared production services:
   +--> PgBouncer or managed database pooler
   +--> Postgres
   +--> Redis
   +--> S3-compatible object storage
   +--> Soketi / realtime layer
```

The app servers should be disposable. They should not store unique user data on local disk. If an app server disappears, another server should be able to serve the same users because sessions, cache, queues, uploads, and database records live in shared services.

For this to work, every app server needs the same core configuration:

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_KEY`
- `APP_URL`
- `TRUSTED_PROXIES`
- Postgres host, database, username, and password.
- PgBouncer host and pool settings when using a self-managed pooler.
- Redis host and credentials.
- S3-compatible storage credentials and bucket values.
- Soketi/Pusher credentials.
- Mail, payment, AI, and third-party service credentials.
- `RUN_MIGRATIONS=false`
- `APP_OPTIMIZE_ON_BOOT=true`

Migrations should run once per release, before or during deployment, not every time a server starts.

## Scaling App Containers Locally

For local testing, start the stack normally:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Then scale HTTP app replicas:

```bash
docker compose -f docker-compose.dev.yml up -d --scale app=3
```

The public URL stays the same:

```text
http://localhost:8000
```

The proxy owns the public port, so extra app containers do not fight over `8000`. The `app` service also avoids a fixed `container_name`, which is required for Compose scaling.

## Readiness And Load Balancer Behavior

Use `/health/ready` for load balancer health checks:

```text
GET /health/ready
```

This endpoint checks the app's dependencies and returns:

- `200` when the app is ready to receive traffic.
- `503` when required dependencies are degraded.

Use `/health/live` only for container/process liveness. Use `/health` for the GUI; it should not be the load balancer check because it renders a page and includes health history.

## Stateless HTTP App Rules

To keep `app` replicas safe to scale:

- Sessions must stay in Redis, not local files.
- Cache must stay in Redis.
- Queue jobs must run in the `queue` service, not the HTTP app.
- Uploaded media must go to S3-compatible storage, not local container disk.
- App containers should not rely on fixed container names.
- App containers should not publish host ports directly.
- Migrations should not run from every app replica.

The current compose file follows this direction with Redis-backed sessions/cache/queues, S3-compatible storage, PgBouncer-backed database connections, a dedicated `queue` service, and `RUN_MIGRATIONS=false` by default.

## Migrations

In a scaled deployment, do not let every app replica run migrations at startup. Run migrations as a one-off release step:

```bash
docker compose -f docker-compose.dev.yml run --rm -e DB_HOST=postgres -e DB_PORT=5432 app php artisan migrate --force
```

For real production, this becomes a CI/CD release step or a one-off job in the target platform. Prefer running migrations directly against Postgres, not through PgBouncer transaction pooling. After migrations pass, roll app containers forward.

## Laravel Cache Behavior

The app supports `APP_OPTIMIZE_ON_BOOT=true`, which warms Laravel config, route, and view caches during container startup.

For product-grade deployments:

- Keep `APP_ENV=production`.
- Keep `APP_DEBUG=false`.
- Keep `APP_OPTIMIZE_ON_BOOT=true`.
- Prefer building optimized artifacts into immutable images when the deployment flow matures.

If using bind mounts locally while developing, cached config/routes can hide changes. For active development, temporarily set:

```text
APP_OPTIMIZE_ON_BOOT=false
```

## Queue Scaling

HTTP scaling and queue scaling are separate.

Scale HTTP traffic with `app` replicas:

```bash
docker compose -f docker-compose.dev.yml up -d --scale app=3
```

Scale background job throughput with more `queue` containers:

```bash
docker compose -f docker-compose.dev.yml up -d --scale queue=2
```

Horizon controls worker processes inside each queue container. Tune worker counts, queues, balancing, retry behavior, and timeouts in `config/horizon.php` and `config/queue.php`.

Practical rule:

- Scale `app` when web/API latency rises.
- Scale `queue` when Horizon shows queue wait time or pending jobs growing.
- Scale both if user requests trigger heavy async work.

## Redis Scaling Notes

Redis is currently a single local service. It is central because it backs:

- Cache.
- Sessions.
- Queue backend.
- Locks.
- Horizon metadata.

For product-grade production, move Redis to a managed or highly available Redis service before app traffic becomes serious. Use separate logical databases or separate Redis instances for cache, sessions, and queues if contention becomes visible.

Watch:

- Memory usage.
- Evictions.
- Queue latency.
- Connection count.
- CPU saturation.

## Postgres Scaling Notes

Postgres is the primary stateful dependency. App replicas increase database connection pressure, so scaling HTTP containers without database planning can overload Postgres.

The local stack includes PgBouncer in front of Postgres:

```text
app / queue -> PgBouncer :5432 -> Postgres :5432
```

PgBouncer lets many short-lived application connections share a smaller pool of real Postgres server connections. This protects Postgres when app replicas or PHP-FPM workers increase.

Before adding many app replicas:

- Set sane PHP-FPM worker limits.
- Review database connection limits.
- Tune PgBouncer pool sizes against Postgres `max_connections`.
- Add indexes for hot queries.
- Move heavy reporting or analytics away from request paths.

Read replicas can help read-heavy workloads later, but they do not replace query optimization or connection pooling.

The current PgBouncer defaults are intentionally conservative:

- `POOL_MODE=transaction`
- `MAX_CLIENT_CONN=500`
- `DEFAULT_POOL_SIZE=40`
- `RESERVE_POOL_SIZE=10`

The local Compose setup uses a Docker Compose secret named `postgres_password`. Postgres reads it with `POSTGRES_PASSWORD_FILE`; PgBouncer reads it through `DB_PASSWORD_FILE` using the small wrapper at `docker/pgbouncer/entrypoint-with-secrets.sh`.

PgBouncer still uses `AUTH_TYPE=plain` locally so it can authenticate to the SCRAM-backed Postgres container with the real password loaded from the mounted secret. For production, prefer a managed pooler when the database provider offers one. If PgBouncer is self-managed in production, keep the same secret-file pattern but source the secret from the production secret manager rather than a developer `.env` file.

Increase pool sizes only after checking Postgres connection usage, query latency, memory, and CPU. PgBouncer increases connection efficiency; it does not increase the amount of work Postgres can execute at once.

## File Storage Scaling

The current local setup uses MinIO as S3-compatible storage. That is good for local production parity because app replicas do not need shared local disks.

For product production:

- Use managed S3-compatible object storage where possible.
- Keep uploaded media and generated assets out of app containers.
- Serve public assets through CDN/object storage URLs when traffic grows.
- Keep signed/private downloads going through app authorization where needed.

## Realtime Scaling

Soketi is currently a single websocket service. Laravel broadcasts to it using the Pusher-compatible driver.

For production scaling:

- Put Soketi behind its own load balancer if multiple websocket instances are needed.
- Confirm sticky behavior or adapter requirements for the chosen Soketi deployment mode.
- Keep HTTP app scaling separate from websocket scaling.
- Monitor concurrent connections, message rate, and CPU.

## Monitoring And Logs

The local stack includes an optional monitoring profile that rehearses the same observability shape we want before multi-server scaling:

```bash
docker compose -f docker-compose.dev.yml --profile monitoring up -d
```

This starts:

- Grafana at `http://localhost:3333`.
- Prometheus at `http://localhost:9090`.
- Loki at `http://localhost:3100`.
- Promtail for Docker container logs.
- cAdvisor for container CPU and memory metrics.
- Node Exporter for host metrics.
- Redis Exporter.
- Postgres Exporter.
- PgBouncer Exporter.
- Blackbox Exporter for `/health/live`, `/health/ready`, and `/health`.
- Soketi metrics scraping.

Grafana is provisioned with Prometheus and Loki data sources plus a Takeer overview dashboard. The local default login is:

```text
admin / takeer_admin
```

Override this with `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`, and `GRAFANA_PORT` in the environment. Do not reuse the local password in production.

For production-grade scaling, monitoring should answer four practical questions:

- Are the app instances ready? Watch `/health/ready` through Blackbox Exporter.
- Is the host/container saturated? Watch CPU, memory, and container restarts.
- Is the database protected? Watch Postgres connections, PgBouncer pools, wait time, and query pressure.
- Are users being affected? Watch request latency, readiness failures, queue wait time, and recent application logs.

The local Loki setup is intentionally small and retains logs for `7d`. Promtail drops Docker log lines older than `24h` when it starts so local old logs do not create noisy backfill errors. In production, Promtail or an equivalent agent should run on every app server and send logs to a central Loki, OpenSearch, Datadog, CloudWatch, or similar backend.

## Deployment Path

The local Docker setup already gives us the single-server version of the production pattern. The remaining work is to make that pattern repeatable across servers.

1. Keep local Compose as the product-grade rehearsal environment. This is in place.
2. Keep migrations as one-off release jobs, not per-replica startup work. The runtime is prepared for this with `RUN_MIGRATIONS=false`.
3. Keep using the Compose `proxy` service as the local load-balancing rehearsal point for scaled `app` replicas. This is in place for one server.
4. Move Postgres, PgBouncer or managed pooling, Redis, and object storage out of any individual app server and into shared production services.
5. Define the production load balancer pool and point it at each server's proxy or app entrypoint.
6. Create a repeatable server bootstrap process for installing Docker, pulling the app image or repo, loading env values, and starting containers.
7. Add centralized logs and metrics so new servers can be verified quickly.
8. Add autoscaling based on CPU, memory, request latency, queue wait time, and readiness failures.
9. Introduce zero-downtime rolling deploys.

## Load Balancer Requirements

The Compose `proxy` service gives us the local load-balancing shape: one public entrypoint in front of multiple `app` replicas. A production load balancer should provide the same contract, plus stronger health checks, TLS handling, connection draining, and operational metrics.

Any production load balancer should:

- Send traffic only to instances passing `/health/ready`.
- Stop routing to instances before termination during rolling deploys.
- Forward `X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Port`, and `X-Forwarded-Proto`.
- Preserve request body limits needed for uploads.
- Use HTTPS publicly, then forward the correct original scheme to Laravel.

Laravel is configured to trust forwarded proxy headers through `TRUSTED_PROXIES`.

## Adding A New App Server

When the shared services and production load balancer are ready, adding a server should follow this runbook:

1. Provision the server with the required CPU, memory, disk, firewall rules, and network access to Postgres, Redis, object storage, Soketi, and the load balancer.
2. Install Docker and Docker Compose.
3. Deploy the application files or pull the production image.
4. Create the server's environment file with the same production values used by the other app servers.
5. Start the containers without running migrations from that server:

```bash
RUN_MIGRATIONS=false docker compose -f docker-compose.prod.yml up -d
```

6. Confirm liveness:

```bash
curl -i http://SERVER_PRIVATE_IP/health/live
```

7. Confirm readiness:

```bash
curl -i http://SERVER_PRIVATE_IP/health/ready
```

8. Add the server to the load balancer pool only after readiness returns `200`.
9. Watch logs, metrics, Horizon, and the health GUI after traffic starts flowing.

The exact compose file name may differ once a production compose file exists. The important rule is that the server starts as an app/queue node using shared production services, not as an isolated stack with its own local database or Redis.

## Operational Checklist

Before calling the setup product-grade, confirm:

- `APP_ENV=production`.
- `APP_DEBUG=false`.
- `TRUSTED_PROXIES` matches the deployment network or platform.
- `/health/ready` is the load balancer readiness check.
- `/health/live` is used only for liveness.
- `RUN_MIGRATIONS=false` on app replicas.
- Migrations run as a one-off release step.
- Sessions/cache/queues use Redis.
- App and queue containers use PgBouncer or a managed database pooler for normal traffic.
- Migrations run directly against Postgres or a migration-safe database endpoint.
- Uploads use S3-compatible storage.
- Queue workers run outside app containers.
- Logs are collected centrally.
- Horizon is protected behind admin access.
- Database backups are automated and restore-tested.
- New app servers can be added without creating local-only state.
- Load balancer registration happens only after `/health/ready` passes.
- Health history retention is intentional through `HEALTH_SNAPSHOT_RETENTION_DAYS`.

## Quick Local Smoke Test

After scaling locally:

```bash
docker compose -f docker-compose.dev.yml ps
curl -i http://localhost:8000/health/live
curl -i http://localhost:8000/health/ready
```

Then watch Horizon and the health GUI:

```text
http://localhost:8000/admin/horizon
http://localhost:8000/health
```

If `/health/live` passes but `/health/ready` fails, the app process is up but one or more dependencies are not ready. Use the readiness JSON or health GUI to identify the failing dependency.
