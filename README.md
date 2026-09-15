# Aqua Nexus 3D Core v1

This is the first build of the **final Aqua Nexus architecture**.

It replaces the old CSS pseudo-3D approach with a real WebGL digital twin using React Three Fiber / Three.js.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## What is already real 3D
- Display aquarium glass
- Animated water shader
- Lighting
- Wave makers
- Sump glass
- Sump chambers driven by X/Y/length/width/height
- Skimmer / return pump / heater / turf scrubber / etc. as procedural 3D models
- Animated water downflow and return flow
- Orbit / zoom controls

## Why procedural models first?
They prove the whole engine is data-driven immediately.

When Blender models are ready, `EquipmentModel.tsx` can load `.glb` models instead, while every tank/sump/equipment rule stays unchanged.

See `ARCHITECTURE.md` and `ROADMAP.md`.

## v0.1.1 dependency fix

Dependencies are pinned to a compatible set.
Do not use `--force` or `--legacy-peer-deps`.

If you attempted installation with the previous build, remove any partial install first:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm cache verify
npm install
npm run dev
```


## v0.1.2
Restored the full Aqua Nexus application navigation shell:
Dashboard, Tanks, Equipment, Sump, Livestock, Maintenance, Water Tests and Knowledge.

The Dashboard and 3D Digital Twin are already real React/Three components.
Other modules are being migrated progressively from the legacy prototype without removing them from the product shell.


## v0.1.3 — Interactive
- Fixed navigation clickability above the WebGL canvas.
- Added working Add Tank modal.
- Added working Add Equipment flow and equipment detail modal.
- Added working Maintenance task creation.
- Added working Water Test recording.
- Added working Livestock creation.
- Added working Sump chamber editor; saving updates the 3D model.
- Tank cards now switch tanks and return to the dashboard.


## v0.1.4 — Full Migration Beta
The old Aqua Nexus functional modules have now been moved into the React/Three.js architecture as working modules, with persistent local data and real Arabic/English UI translation. Legacy livestock, disease, inventory and emergency catalogs were ported directly from the old prototype.


## v0.1.5.2 — Clean Development Build

This build deliberately disables PWA/Service Worker locally and uses standard Next.js development mode instead of Turbopack.

Why:
- prevents stale PWA HTML/CSS/JS caches during active development
- avoids Turbopack workspace-root confusion when multiple package-lock.json files exist
- makes localhost deterministic while Aqua Nexus is still under construction

Recommended clean start on Windows PowerShell:

```powershell
cd C:\projects\Aqua_Nexus_3D_v1_5_2_Clean_Dev
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run dev
```

If Chrome previously registered a Service Worker for localhost, open once in an Incognito window or clear localhost site data. This build will never register a new Service Worker.


## v0.1.5.3 — Workspace Root + Old Service Worker Fix

This development build fixes two Windows localhost problems:

1. `next.config.mjs` explicitly fixes the project tracing/build context to the Aqua Nexus folder.
   This prevents Watchpack from scanning `C:\hiberfil.sys`, `pagefile.sys`, etc.

2. `/sw.js` is a self-destruct development worker.
   If Chrome still has an old Aqua Nexus localhost Service Worker, it updates to this worker,
   clears Aqua Nexus caches, unregisters itself, and stops intercepting development traffic.

3. CSS `end` flex-alignment warnings were normalized to `flex-end`.

Recommended start:

```powershell
cd C:\projects\Aqua_Nexus_3D_v1_5_3_Root_SW_Fix
.\START_CLEAN_DEV.ps1
```

Or manually:

```powershell
if ((Test-Path C:\projects\package-lock.json) -and -not (Test-Path C:\projects\package.json)) {
  Remove-Item C:\projects\package-lock.json -Force
}
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```


## v0.1.6.1
This build finalizes the display-tank Digital Twin controls:
dimensions, display-equipment placement, wave-maker flow visualization, corrected sump/downflow/return logic,
and restores the integrated Acclimation module.


## v1.7.2
- Removed duplicated dimensions and removed the bottom equipment scene box.
- Added separate side cards for display dimensions, sump dimensions, display volume, sump volume, and total system volume.
- Added compact transparent display-equipment labels on the tank.
