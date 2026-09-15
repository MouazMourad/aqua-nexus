# Aqua Nexus 3D — Final Architecture

## Decision
The final product is no longer based on a single HTML file or CSS pseudo-3D.

Core:
- React / Next.js
- React Three Fiber
- Three.js
- Drei
- Zustand
- Blender -> GLB/GLTF assets
- PostgreSQL/API in the cloud phase
- PWA for mobile installation

## 3D Digital Twin
The 3D scene is generated from tank data:
- Display length / width / height
- Sump geometry
- Chamber X/Y positions and chamber dimensions
- Water level
- Equipment location
- Flow direction

Current v1 models are procedural Three.js geometry so the engine is already dynamic.
Later, each procedural model can be replaced by a Blender GLB without changing the data model.

## Modules from the current prototype
Already represented in the target domain:
- Multi-tank
- Marine / Freshwater
- Chemistry
- Maintenance
- Equipment
- Sump
- Tank Health

Next migration batches:
1. Inventory + alerts
2. Livestock + library + compatibility + bioload
3. Diseases + treatment + quarantine
4. Dosing + doser chambers + maintenance follow-up
5. Timeline + photos + water changes + feeding
6. RO/DI + expenses + reports + export
7. Smart insights / event correlation
8. Authentication + cloud sync
9. Subscription feature flags

## Health
Tank Health = Chemistry Health * 70% + Maintenance Health * 30%

## Asset strategy
Blender library:
- Protein skimmer
- Return pump
- Filter sock / roller filter
- Reactor
- Heater
- Wave maker
- Lighting
- Doser
- UV
- Ozone
- Refugium light
- Turf scrubber
- Sensors / probes

Each asset is exported as GLB and mapped to EquipmentKind.
