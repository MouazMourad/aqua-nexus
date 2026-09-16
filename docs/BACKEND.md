# Aqua Nexus Backend

## Current mode
The application now runs as a server-capable Next.js app. No user/account system is enabled yet. Until accounts are added, each browser is isolated by an anonymous `x-aqua-device-id` workspace key generated locally by the PWA.

If `DATABASE_URL` is not configured, Aqua Nexus remains local-first and continues to work from Zustand/local storage. When PostgreSQL is available, the CloudSyncBridge automatically backs the current anonymous workspace to the server.

## Server components
- PostgreSQL persistence for full tank state snapshots with optimistic versioning.
- Anonymous workspace isolation so public preview visitors do not share one tank dataset.
- Tank collection/single-tank APIs.
- Import/export backup APIs.
- Durable server media store for aquarium photos when `AQUA_UPLOAD_DIR` is configured.
- Aqua AI server gateway with local fallback and optional external LLM/Vision provider.
- AI audit log.
- Push subscription persistence and VAPID sender.
- Scheduled tank-watch job for emergency, overdue quarantine doses, near-term chemistry predictions and smart warnings.
- Docker Compose deployment with PostgreSQL and Caddy HTTPS.

## Main endpoints
- `GET /api/health`
- `GET|POST /api/tanks`
- `GET|PUT|DELETE /api/tanks/:id`
- `POST /api/sync/import`
- `GET /api/sync/export`
- `POST /api/ai/chat`
- `POST /api/ai/vision`
- `POST|DELETE /api/push/register`
- `GET /api/push/key`
- `POST /api/media/upload`
- `GET /api/media/:id`
- `GET|POST /api/jobs/tank-watch` (requires `Authorization: Bearer <CRON_SECRET>`)

All workspace-scoped API calls require `x-aqua-device-id` until the account layer replaces anonymous workspaces.

## Database
Schema is created automatically on the first database-backed request. A matching reference migration is available at `db/migrations/001_backend.sql`.

Core tables:
- `aqua_workspaces`
- `aqua_tanks`
- `aqua_media_assets`
- `aqua_push_subscriptions`
- `aqua_ai_audit`
- `aqua_job_runs`

Tank state is stored as JSONB so the existing mature Aqua Nexus domain model can move to the backend without losing modules. Later, high-volume history tables can be normalized without redesigning the client.

## AI provider
Without AI environment variables, `/api/ai/chat` uses the existing Aqua Nexus local tank-intelligence engine. `/api/ai/vision` keeps the local visual triage workflow and reports that external Vision is not configured.

When the three provider variables are set, the gateway sends the unified Aqua Nexus tank context to an OpenAI-compatible chat/vision endpoint:
- `AQUA_AI_BASE_URL`
- `AQUA_AI_API_KEY`
- `AQUA_AI_MODEL`

The provider key remains server-side and is never exposed to the browser.

## Images
Set `AQUA_UPLOAD_DIR` to durable storage on the VPS. Images are stored as files; PostgreSQL keeps metadata and paths only. The default Docker Compose volume mounts `/data/uploads` for this purpose.

## Push
Configure matching VAPID keys on the server. The client requests the current public key from `/api/push/key`, so keys can be rotated without rebuilding the PWA.

## Deployment
The included stack contains:
- `app`: Next.js server
- `postgres`: PostgreSQL 16
- `caddy`: HTTPS reverse proxy

Copy `.env.example` to `.env`, set strong secrets/domain values, then deploy the Compose stack on the VPS. Backups can be run with `ops/backup.sh` and should also be copied off the VPS.

## Intentionally deferred
The following are not enabled yet by design:
- User signup/login
- Ownership by user ID
- Free/Pro subscriptions and payment
- Cross-device identity/account sync

When accounts are introduced, anonymous workspaces can be claimed/migrated into the authenticated user's workspace without changing the tank model.
