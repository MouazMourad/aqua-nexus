# Aqua Nexus — Current Migration / Product Status

## Status

**Version:** v0.3.0-rc.2  
**Stage:** Release Candidate / controlled testing  
**Architecture:** Next.js + React + Three.js, local-first with optional PostgreSQL Device Backup

The legacy migration phase is effectively complete. This file now tracks production-readiness status rather than module migration.

## Functional coverage

The current build includes:
- Dashboard and 3D digital twin
- Tanks / setup / biological cycle
- Equipment and energy/lifecycle monitoring
- Unified equipment/controller import from structured files, text or screenshots with editable review, provenance and automatic domain routing
- Lighting Intelligence with schedule/spectrum modelling, Top/Front/3D estimated PAR maps, measured-PAR calibration, screenshot/file import, Tank Brain and Local Best AI integration
- 2D/3D sump builder and safety audit
- Livestock, compatibility and bioload
- Acclimation, parallel timers, distress exceptions, Coral Dip/Rinse
- Chemistry and data-quality controls with strict measured-vs-reference evidence separation
- Maintenance guided checklists
- Inventory and consumption
- Disease / quarantine / treatment
- Emergency workflows
- Feeding / dosing / water change / RO/DI
- Journal / photo storage
- Expenses / timeline / reports
- Vacation / relocation / restart / archive lifecycle
- Local Best AI and domain-specific outcome evaluation
- Aqua Nexus Academy with contextual learning links

## Production-readiness hardening

Implemented:
- deterministic safety authority over optional external AI
- intervention-density guards
- global numeric sanity
- full Tank event coverage contract
- IndexedDB persistence + verified fallback
- corrupt fallback recovery
- explicit persistence health status
- strict Full Recovery Backup completeness
- per-domain long-term historical archive
- storage-level cursor pagination
- optional Device Backup only after explicit opt-in
- PostgreSQL migration/API integration CI
- distributed DB-backed rate limiting
- streamed body-size enforcement
- auditable high-risk override reasons
- auditable Product / Tank Brain / Health Model / Chemistry Evidence versions stamped into new health history
- document lang/dir synchronization
- automated accessibility smoke
- component extraction from Acclimation, Equipment and AI

## Cloud semantics

There is **no user account system yet**.

The current backend feature is Device Backup tied to the browser/device workspace. It is disabled by default and must not be described as multi-device account sync.

## Tester phase

The current priority is tester feedback on:
- clarity of decisions and alerts
- mobile usability
- workflow friction
- aquarium safety behavior
- data safety / backup confidence
- edge cases from real tanks

Large unrelated feature expansion is intentionally paused during this phase. Unified import is already implemented; the next priority is controlled tester validation, first-time-user friction reduction and production hardening driven by real defects.
