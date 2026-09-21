# Aqua Nexus Roadmap — v0.3.0 RC

## Complete in the current RC

- Local-first multi-tank React/Next architecture
- Marine and freshwater workflows
- Smart Setup + biological cycling locks
- Dashboard + 3D digital twin
- Lighting Intelligence with multi-channel schedules, estimated/calibrated PAR, Top/Front/3D light maps and Tank Brain/AI integration
- Chemistry, maintenance, equipment, sump, livestock, inventory
- Feeding, dosing, water changes, RO/DI
- Acclimation with parallel timers, distress lanes and Coral Dip/Rinse gates
- Disease, treatment, quarantine and emergency workflows
- Journal/photos, expenses, reports and Full Recovery Backup
- Tank Brain, deterministic safety gates and Local Best AI
- Domain-specific action-plan outcome learning
- Runtime + compile-time event coverage contracts
- Global numeric sanity enforcement
- Vacation / relocation / restart / archive lifecycle
- Indexed long-term historical store with cursor pagination
- Storage failure recovery and torture tests
- Optional Device Backup with optimistic versioning
- PostgreSQL/API integration tests in CI
- Distributed database-backed rate limiting
- Streamed request-size enforcement
- Arabic/English document locale synchronization
- Desktop Chromium, Android Chromium and iPhone WebKit critical journeys

## Current product policy

Aqua Nexus stays **local-first during controlled testing**.

Device Backup is optional and off by default. It is not presented as an account or cross-device sync service.

## Next phase after tester feedback

Only after controlled testing confirms the RC:
- build the vendor-neutral import layer for exported controller/app files and screenshot-assisted lighting-program extraction
- refine UX from real tester feedback
- finish deeper component decomposition where it improves maintainability
- tune long-term historical retention defaults
- add an account/recovery architecture if multi-device SaaS becomes a real requirement
- harden public-abuse controls if the product opens to anonymous public traffic
- package store/mobile wrappers only after web/PWA behavior is stable

## Release rule

No new feature is accepted into the RC unless it addresses a verified tester problem, a safety issue, data integrity, accessibility, or production reliability.
