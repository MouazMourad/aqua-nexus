# Aqua Nexus 3D — Architecture (v0.3.0-rc.3)

## Product posture
Aqua Nexus is a local-first Release Candidate for controlled testing. Accounts and full cloud sync are intentionally outside the current acceptance scope.

## Core stack
- React / Next.js
- React Three Fiber / Three.js / Drei
- Zustand operational state
- IndexedDB durable local persistence with verified fallback
- PostgreSQL/API backend paths for optional server features
- PWA/mobile browser support

## Product architecture
Pages own data-entry workflows, but they do not own separate decision logic. The canonical flow is:

`Tank state -> domain validation/safety -> Tank Brain / Intelligence Core -> dashboard, alerts and AI presentation`

Key domains currently include multi-tank setup, biological cycling, chemistry, maintenance, equipment, unified device import, lighting, sump, livestock, acclimation, inventory, feeding, dosing, water changes, RO/DI, quarantine, emergencies, journal/media, reports, lifecycle and long-term history.

## Chemistry evidence contract
Chemistry has a hard evidence distinction:
- **Measured evidence:** values explicitly measured by the user or accepted from a validated import/device source.
- **Reference/default values:** educational/setup references only.

Reference/default values:
- are never returned by the canonical latest-parameter measurement helper;
- never count toward weekly chemistry completion;
- never satisfy freshness or dosing-readiness requirements;
- are separated from measured chemistry in Tank Brain and external AI context;
- are no longer persisted as initial chemistry by Smart Setup.

## Tank Brain and AI
Deterministic aquarium logic remains authoritative for safety-sensitive decisions. External AI is an optional synthesis/explanation layer and cannot override dosing, treatment, acclimation, cycling or intervention gates.

Canonical Tank Brain snapshot schema: **aqua-nexus-tank-brain/v2**.
AI context schema: **aqua-nexus-ai-context/v2**.

## Health model
Current Health Model **2.0.0** combines only known components and normalizes active weights:
- Chemistry: 30%
- Maintenance: 15%
- Bioload: 15%
- Equipment adequacy: 20%
- Livestock compatibility: up to 15%, scaled by verified coverage
- Livestock condition: 5%

A hard chemistry safety violation overrides the descriptive band so a chemically critical tank is never described as stable merely because the weighted average is high.

## Decision model versioning
Central source: `src/domain/version.ts`.

Current versions:
- Product: **0.3.0-rc.3**
- Tank Brain: **1.1.0**
- Health Model: **2.0.0**
- Chemistry Evidence: **1.1.0**

New Health Snapshots store the model versions used at calculation time, preserving auditability when algorithms evolve.

## Unified import
Equipment/controller and lighting imports support structured files, text extraction and screenshot-assisted AI extraction where configured. Every import is reviewed before apply. Provenance, confidence, source fingerprint and warnings are retained; implausible chemistry is blocked locally before entering tank state.

## 3D Digital Twin
The 3D scene is generated from real tank state:
- display dimensions and water volume;
- sump geometry, chamber positions and water levels;
- equipment location;
- lighting schedule/coverage;
- flow/system layout.

Procedural Three.js models can later be replaced by GLB/GLTF assets without changing the domain model.

## Data integrity hardening
- All decision-facing chemistry consumers use the canonical measured-chemistry evidence API instead of array position.
- Operational timestamps beyond the allowed clock-skew window are rejected from chemistry/import/recovery paths.
- Due-date semantics use local calendar dates; event timestamps remain ISO/UTC.
- Multi-step corrective dosing requires a measured retest after each executed step and recalculates the next step from that evidence; changed system volume or unsafe response invalidates the plan.
- Recovery restore uses preview, explicit confirmation, automatic pre-action checkpoint and one-step rollback.
- Local browser persistence enforces a single-writer tab lease to prevent last-write-wins data loss.

## Data and history
Operational state is local-first. Large media and historical overflow are stored outside the hot Tank JSON. Full Recovery Backup validates structure and fails closed rather than exporting a knowingly incomplete recovery artifact.

## Release acceptance
A feature may not bypass deterministic safety, measured-data evidence rules, history/event coverage or recovery guarantees. Safety, data integrity and core usability issues take priority over net-new feature expansion.
