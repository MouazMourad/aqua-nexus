# Aqua Nexus 3D — v0.3.0 RC.2

Aqua Nexus is a local-first aquarium management platform for marine and freshwater systems. It combines tank setup, chemistry, livestock, acclimation, maintenance, equipment, Lighting Intelligence, sump, dosing, feeding, water changes, RO/DI, quarantine, emergencies, inventory, reports, long-term history and deterministic aquarium intelligence.

## Current release posture

**v0.3.0-rc.2** is a Release Candidate for controlled testing.

The product is intentionally **local-first**. Full JSON Recovery Backup is the authoritative portable recovery artifact. Experimental Device Backup exists only when the user explicitly enables it from Settings; it is not an account system and not multi-device sync.

## Core safety model

- Deterministic aquarium rules are authoritative for dosing, treatment, acclimation, biological cycling and intervention gates.
- External AI is optional synthesis only; it cannot override deterministic safety logic.
- High-risk overrides require a written reason and are logged.
- Meaningful Tank fields are covered by compile-time and runtime event contracts.
- Chemistry reference/default values are never treated as measured evidence, never complete weekly tests, and never feed dosing/freshness decisions as measurements.
- Numeric entry is validated at save boundaries, not only through HTML controls.
- Health history is stamped with Tank Brain, Health Model and Chemistry Evidence versions for auditability.

## Lighting Intelligence

- Lighting hardware remains sourced from the real Equipment registry; the lighting page adds schedule, spectrum and optical modelling without duplicating fixtures.
- Multi-channel schedules are normalized into a vendor-neutral LightingProgram.
- Top, front and interactive 3D light-field views use the same deterministic estimator consumed by Tank Brain and Local Best AI.
- PAR is explicitly labelled estimated until calibrated with measured points from the user's aquarium.
- Program changes are versioned so Tank Brain can relate lighting changes to later chemistry/livestock observations without claiming causation.
- Vendor-neutral file and screenshot import is implemented with editable review drafts, provenance/confidence, duplicate protection and local validation before apply.

## Data safety

- Zustand operational state persists to IndexedDB with verified localStorage fallback.
- Storage failure is surfaced to the user instead of failing silently.
- Full-resolution journal media is stored outside Tank JSON.
- Full Recovery Backup fails closed when required media/history cannot be read.
- Long-term history uses an indexed per-domain IndexedDB store and cursor pagination.
- Archived history is rehydrated into Full Recovery Backup.

## Backend

The optional backend supports PostgreSQL tank storage, optimistic versioning, media, AI audit and push state. CI runs real PostgreSQL migrations and API integration tests.

Device Backup is **off by default** and requires explicit user opt-in.

## Quality gates

```bash
npm ci
npm test
npm run build
npm run test:backend
npm run test:e2e
```

GitHub Actions additionally runs PostgreSQL 16, migrations, backend integration, Chromium and WebKit critical journeys.

## Development

```bash
npm ci
npm run dev
```

PWA registration is production-only so local development stays deterministic.

See `ARCHITECTURE.md`, `ROADMAP.md`, and `MIGRATION_STATUS.md` for the current product state.

## Decision model versions

- Tank Brain: **1.0.0**
- Health Model: **2.0.0**
- Chemistry Evidence: **1.0.0**

Model versions are centralized in `src/domain/version.ts` and stamped into new Health Snapshots.
