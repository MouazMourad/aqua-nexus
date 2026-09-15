# Aqua Nexus 3D v0.1.4 — Full Migration Beta

## Functional modules now present in React
- Dashboard / real Three.js Digital Twin
- Multi-tank management
- Equipment
- Sump + chamber geometry
- Livestock
- Expanded Livestock Library (ported from legacy)
- Chemistry + history chart
- Maintenance
- Inventory
- Diseases & Treatment library (ported from legacy)
- Tank Timeline
- Photo Journal
- Water Change Manager
- Feeding Manager
- Dosing Calculator + Doser visualization + follow-up task
- Quarantine
- Emergency response library (ported from legacy)
- RO/DI log
- Expenses
- Generated Alerts
- Reports / Print / JSON / CSV backup
- Settings / Backup Restore
- LocalStorage persistence
- PWA manifest + service worker
- Arabic / English actual UI translation

## Still to polish before final release
- Blender GLB equipment asset library
- drag/drop graphical sump editor
- deeper compatibility engine
- richer charts / forecasts / event correlation
- cloud backend, accounts and sync
- subscription feature flags
- App Store / Play Store wrapper


## v0.1.5 Feature Parity
- 7-step Smart Setup Wizard restored.
- Executive dashboard restored with guidance strip, health trend, due maintenance,
  chemistry analysis, smart insights, event correlation and 7-day forecast.
- Dashboard cards link directly to Maintenance / Chemistry / Alerts.
- Livestock entry now uses category-specific dropdown lists plus "Other".
- Disease/treatment entries can create treatment follow-up maintenance tasks.
- Doser manager now supports channel count, liquid, capacity, remaining quantity,
  daily/weekly/monthly consumption and projected remaining days.
- Logged doses create follow-up maintenance tasks and reduce matching doser liquid.
- Weekly chemistry measurement is a core maintenance requirement.
- Chemistry Health is penalized after 7 days without a new chemistry test.
- Maintenance report now separates recurring overdue and upcoming tasks.
- Marine and Freshwater themes now use different application colors.


## v0.1.5.4
- Maintenance page now has a dedicated printable recurring maintenance plan / PDF layout.
- Livestock add flow now performs compatibility analysis before saving.
- Compatibility checks include minimum tank size, maturity, schooling, predator/prey risk,
  coral/invertebrate/plant safety and aggression indicators from the legacy catalog.
- Projected bioload is shown before adding livestock.
- High/danger projected bioload generates explicit warnings.
- Strong conflicts require explicit user acknowledgement before the add button is enabled.

## v0.1.6 — Premium Visual Digital Twin
- Reworked the main tank + sump into one premium visual system.
- Added clearly visible animated DOWNFLOW and RETURN routes with glowing moving arrowheads.
- Lighting is now fully data-driven: 1, 2, 3 or 4 lighting devices are rendered as separate fixtures.
- Every lighting fixture casts its own colored light into the display tank.
- Added a marine/freshwater habitat layer, animated fish based on livestock count, substrate, rocks/coral/plants and suspended particles.
- Added a metal support frame and stronger glass/water presentation.
- Sump chamber equipment now renders from both equipment location and chamber item metadata.
- Added chamber labels and animated horizontal water direction inside the sump.
- Marine and freshwater visuals remain theme-aware.


## v0.1.6.1 — Tank Finalization & Acclimation Restore
- Corrected system water route: display overflow -> first sump chamber -> chamber sequence -> return-pump chamber -> display.
- Sump internal flow now follows chamber order instead of a fixed visual direction.
- Fish motion is constrained to the actual display water volume.
- Added L / W / H dimension guides directly around the 3D tank.
- Display equipment now supports real editable X/Y/Z placement and rotation.
- Wave maker direction and strength generate a live 3D water-flow field inside the tank.
- Lighting is dynamic and data-driven: 1, 2, 3, 4 or more fixtures appear automatically.
- Any equipment assigned to the display appears immediately in the 3D view.
- Equipment page now includes a live display-layout workspace.
- Dashboard Digital Twin footprint reduced to leave more room for executive information.
- Acclimation restored as a first-class Aqua Nexus module with shipment items, temperature equalization,
  drip timers, placement advice, event log, and automatic livestock/timeline update on transfer.


## v0.1.6.1.1 Hotfix
- Fixed AcclimationPage build failure caused by a literal `\\n` token inside TypeScript source.
- Revalidated all TS/TSX files for parser-level TypeScript syntax errors.


## v0.1.6.2 — Current Fixes
- System camera/framing revised so the sump is no longer hidden by the stage and the whole aquarium + stand + sump remains visible.
- Exact display and sump dimensions are always shown as numeric HUD values, plus 3D dimension markers.
- Legacy lighting/wave-maker/overflow devices accidentally stored as External are migrated back to Display.
- Equipment page now previews the full system, including sump and an external-equipment rack.
- All equipment cards are editable: name, brand, model, status, service interval, location.
- Any device moved to Display gains live X/Y/Z/rotation/scale controls; lights also have live height control; wave makers retain flow direction/strength.
- Added devices receive a sensible default location by equipment type and appear immediately in the relevant system area.
- Acclimation rebuilt from the supplied Aquarium Acclimation Wizard flow, adapted to Aqua Nexus: no language step and no redundant aquarium-type selection.
- Acclimation inherits Aqua Nexus language and selected-tank type, adds shipment categories/items, arrival health, temperament/sensitivity, optional photo, suggested order, preflight checklist, float timer, pause/resume/+time, drip queue, emergency/defer handling, compatibility check before transfer, event log, printable livestock input register and TXT export.


## v0.1.6.3 — Final Tank Plumbing Placement
- Overflow now owns the display-tank drain position.
- Overflow supports two plumbing modes:
  - Combined: drain and return are both inside the same overflow assembly.
  - Separate: drain remains in the overflow while the return outlet can be positioned independently.
- The equipment editor exposes live X/Y/Z placement for drain and, when separate, return outlet.
- Return direction is editable.
- Downflow and return routes now follow the actual selected tank positions instead of fixed left/right endpoints.
- If drain and return are on the same side, their vertical pipes are automatically offset so both remain visible.
- A dedicated return nozzle is rendered in the 3D scene.


## v0.1.7 — Final UI Polish
- Dashboard composition finalized:
  - health, maintenance and chemistry grouped in the top information row.
  - 3D aquarium moved to the visual row beside the equipment panel.
  - scene footprint and equipment panel now share the same visual band.
- Guidance strip converted to a seamless continuous news ticker.
- Tank Health card now has translucent green/orange/red state coloring.
- Health pulse rate is dynamic: faster in danger, progressively slower as health improves.
- Main navigation redesigned as a macOS-style wave-magnification dock.
- Each module icon has its own color.
- Native horizontal scrollbar is hidden; translucent left/right arrows scroll the dock.
- Global UI converted to a stronger glass-aquarium visual language.
- Marine tanks use a blue glass environment; freshwater tanks use a green glass environment.
- Mobile blur intensity is reduced for better GPU performance.
- Reduced-motion accessibility is respected.


## v0.1.7.1 — Scene HUD Fix
- No functional or visual-system changes outside the 3D scene information overlay.
- Removed overlapping floating text from the WebGL scene.
- Tank and sump dimension guide lines remain visible.
- Numeric tank/sump dimensions moved into a fixed compact bilingual HUD.
- Net tank volume reduced to a compact badge instead of a large central overlay.
- Equipment names moved into a compact bottom legend (up to 6 names + remainder count).
- Drain/return text moved to a small flow legend; animated water paths remain unchanged.
- Arabic and English now use the exact same HUD structure and positioning.


## v1.7.2
- Removed duplicated dimensions and removed the bottom equipment scene box.
- Added separate side cards for display dimensions, sump dimensions, display volume, sump volume, and total system volume.
- Added compact transparent display-equipment labels on the tank.


## v0.1.7.2.1 — Arabic Equipment Labels Hotfix
- Fixed 3D equipment labels disappearing when switching the Aqua Nexus UI to Arabic.
- The Three/Drei scene wrapper is now direction-neutral so RTL no longer interferes with HTML transform positioning.
- RTL/LTR is applied only to label text and the side information cards.
- No scene geometry, plumbing, dashboard layout, equipment positions, or other UI was changed.


## v0.1.7.2.2 — Arabic Label Rendering Fix
- Replaced Three/Drei HTML equipment labels with a regular DOM overlay above the 3D canvas.
- Arabic and English now use exactly the same label rendering path.
- Labels remain small, translucent, and distributed around the tank to reduce overlap.
- No tank/sump geometry, water flow, equipment placement, dashboard structure, or theme was changed.


## v0.1.7.2.3 — Tracking Labels Fix
- Equipment labels now follow the actual 3D pieces while the camera rotates.
- Arabic and English still share the same DOM overlay path.
- Fixed the frozen-screen-label issue.


## v0.1.7.2.3.1 — Client Directive Hotfix
- Fixed AquariumScene.tsx build error by moving `"use client"` to the first line of the file.
- Tracking-label logic is unchanged.
