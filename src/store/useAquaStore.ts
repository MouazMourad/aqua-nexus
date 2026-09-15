"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AquaState, ChemistryReading, Equipment, Language, Tank } from "@/domain/types";
import { demoMarineTank, demoFreshwaterTank } from "@/data/demoTank";
import { liters, round1 } from "@/lib/units";
import { defaultDisplayPosition } from "@/lib/displayLayout";

interface AquaStore extends AquaState {
  setLanguage: (language: Language) => void;
  selectTank: (tankId: string) => void;
  addTank: (tank: Tank) => void;
  deleteTank: (tankId: string) => void;
  patchTank: (tankId: string, updater: Partial<Tank> | ((tank: Tank) => Tank)) => void;
  addChemistryReading: (tankId: string, reading: ChemistryReading) => void;
  replaceData: (data: Pick<AquaState, "language"|"selectedTankId"|"tanks">) => void;
  resetDemo: () => void;
}

function recalcTank(tank: Tank): Tank {
  const gross = liters(tank.display.length, tank.display.width, tank.display.height);
  const net = gross * (1 - tank.display.displacementPercent / 100);
  const sumpGross = tank.sump.enabled ? liters(tank.sump.dimensions.length,tank.sump.dimensions.width,tank.sump.dimensions.height) : 0;
  const sumpNet = sumpGross * tank.sump.operatingFillPercent / 100;
  return {
    ...tank,
    display:{...tank.display,grossLiters:round1(gross),netLiters:round1(net)},
    systemVolumeLiters:round1(net+sumpNet)
  };
}

function normalize(tank: Tank): Tank {
  return recalcTank({
    ...tank,
    equipment:(tank.equipment ?? []).map((e,i)=>{
      const visualKind=["lighting","waveMaker","overflow"].includes(e.kind);
      const migrateLegacy=visualKind && e.location==="external" && !e.displayPosition;
      const location=(migrateLegacy?"display":e.location) as Equipment["location"];
      const peers=(tank.equipment??[]).filter(x=>x.kind===e.kind && (["display","external"].includes(x.location))).length;
      return {...e,location,displayPosition:location==="display"?(e.displayPosition??defaultDisplayPosition(e.kind,i,Math.max(1,peers))):e.displayPosition};
    }),
    chemistry:tank.chemistry ?? [],
    maintenance:tank.maintenance ?? [],
    livestock:tank.livestock ?? [],
    inventory:tank.inventory ?? [],
    timeline:tank.timeline ?? [],
    photos:tank.photos ?? [],
    feeding:tank.feeding ?? [],
    dosing:tank.dosing ?? [],
    doserChannels:tank.doserChannels ?? [],
    quarantine:tank.quarantine ?? [],
    expenses:tank.expenses ?? [],
    waterChanges:tank.waterChanges ?? [],
    rodi:tank.rodi ?? [],
    acclimationSessions:tank.acclimationSessions ?? [],
    createdAt:tank.createdAt ?? new Date().toISOString()
  });
}

export const useAquaStore = create<AquaStore>()(
  persist(
    (set) => ({
      language:"ar",
      selectedTankId:demoMarineTank.id,
      tanks:[demoMarineTank,demoFreshwaterTank],

      setLanguage:(language)=>set({language}),
      selectTank:(selectedTankId)=>set({selectedTankId}),

      addTank:(tank)=>set((state)=>({
        tanks:[...state.tanks,normalize(tank)],
        selectedTankId:tank.id
      })),

      deleteTank:(tankId)=>set((state)=>{
        const tanks=state.tanks.filter(t=>t.id!==tankId);
        return {
          tanks,
          selectedTankId: state.selectedTankId===tankId ? (tanks[0]?.id ?? "") : state.selectedTankId
        };
      }),

      patchTank:(tankId,updater)=>set((state)=>({
        tanks:state.tanks.map(t=>{
          if(t.id!==tankId)return t;
          const next=typeof updater==="function" ? updater(t) : {...t,...updater};
          return normalize(next);
        })
      })),

      addChemistryReading:(tankId,reading)=>set((state)=>({
        tanks:state.tanks.map(t=>t.id===tankId
          ? normalize({...t,chemistry:[reading,...t.chemistry]})
          : t)
      })),

      replaceData:(data)=>set({
        language:data.language,
        selectedTankId:data.selectedTankId,
        tanks:data.tanks.map(normalize)
      }),

      resetDemo:()=>set({language:"ar",selectedTankId:demoMarineTank.id,tanks:[demoMarineTank,demoFreshwaterTank]})
    }),
    {
      name:"aqua-nexus-3d-v1",
      version:5,
      migrate:(persisted:any)=>{
        const p=persisted??{};
        return {...p,tanks:(p.tanks??[]).map((t:Tank)=>normalize(t))};
      },
      merge:(persisted:any,current)=>{
        const p=persisted??{};
        return {...current,...p,tanks:(p.tanks??current.tanks).map((t:Tank)=>normalize(t))};
      }
    }
  )
);
