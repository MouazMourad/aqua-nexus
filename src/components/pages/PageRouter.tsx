"use client";
import { useEffect,type ReactNode } from "react";
import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { AquaDashboardContent } from "@/components/dashboard/AquaDashboardContent";
import { CreatorContactStrip } from "@/components/CreatorContactStrip";
import { TanksPage } from "./TanksPage";
import { EquipmentPage } from "./EquipmentPage";
import { LightingPage } from "./LightingPage";
import { SumpPage } from "./SumpPage";
import { LivestockPage } from "./LivestockPage";
import { LifeJourneyPage } from "./LifeJourneyPage";
import { TankConsumptionPage } from "./TankConsumptionPage";
import { AcclimationPage } from "./AcclimationPage";
import { LibraryPage } from "./LibraryPage";
import { ChemistryPage } from "./ChemistryPage";
import { MaintenancePage } from "./MaintenancePage";
import { InventoryPage } from "./InventoryPage";
import { DiseasesPage } from "./DiseasesPage";
import { TimelinePage } from "./TimelinePage";
import { JournalPage } from "./JournalPage";
import { WaterChangePage } from "./WaterChangePage";
import { FeedingPage } from "./FeedingPage";
import { DosingPage } from "./DosingPage";
import { QuarantinePage } from "./QuarantinePage";
import { EmergencyPage } from "./EmergencyPage";
import { RODIPage } from "./RODIPage";
import { ExpensesPage } from "./ExpensesPage";
import { AlertsPage } from "./AlertsPage";
import { ReportsPage } from "./ReportsPage";
import { SettingsPage } from "./SettingsPage";
import { AcademyPage } from "./AcademyPage";
import { AcademyShortcut } from "@/components/academy/AcademyShortcut";
import { biologicalCycleStatus,isCyclePageAllowed } from "@/domain/biologicalCycle";
import { useAquaStore } from "@/store/useAquaStore";
import { bi } from "@/i18n";
import { markPageFeaturesLearned } from "@/lib/featureDiscovery";

export function PageRouter({page,tank,tanks,selectedTankId,onSelectTank,onNavigate}:{page:AppPage;tank:Tank;tanks:Tank[];selectedTankId:string;onSelectTank:(id:string)=>void;onNavigate:(p:AppPage)=>void}) {
 const lang=useAquaStore(s=>s.language),cycle=biologicalCycleStatus(tank);
 useEffect(()=>{markPageFeaturesLearned(page)},[page]);
 let content:ReactNode;
 if(cycle.active&&page!=="academy"&&!isCyclePageAllowed(page)){
  content=<section className="page-grid"><div className="card panel full-span"><div className="inline-alert warn"><b>🔒 {bi(lang,"هالوحدة مقفلة خلال الدورة البيولوجية.","This module is locked during biological cycling.")}</b><p>{bi(lang,"Aqua Nexus عم يوقف العمليات غير المرتبطة بالدورة لحماية الحوض. كمّل خطوات الدورة والقياسات أولاً.","Aqua Nexus pauses non-cycle workflows to protect the tank. Complete cycling steps and measured tests first.")}</p><button className="btn primary" onClick={()=>onNavigate("dashboard")}>{bi(lang,"العودة لمتابعة الدورة","Back to cycle tracking")}</button></div></div></section>;
 }else switch(page){
  case"tanks":content=<TanksPage tanks={tanks} selectedTankId={selectedTankId} onSelect={onSelectTank}/>;break;
  case"equipment":content=<EquipmentPage tank={tank}/>;break;
  case"lighting":content=<LightingPage tank={tank} onEquipment={()=>onNavigate("equipment")}/>;break;
  case"sump":content=<SumpPage tank={tank}/>;break;
  case"livestock":content=<LivestockPage tank={tank} onLibrary={()=>onNavigate("library")}/>;break;
  case"lifejourney":content=<LifeJourneyPage tank={tank}/>;break;
  case"consumption":content=<TankConsumptionPage tank={tank}/>;break;
  case"acclimation":content=<AcclimationPage tank={tank}/>;break;
  case"library":content=<LibraryPage tank={tank}/>;break;
  case"chemistry":content=<ChemistryPage tank={tank}/>;break;
  case"maintenance":content=<MaintenancePage tank={tank}/>;break;
  case"inventory":content=<InventoryPage tank={tank}/>;break;
  case"diseases":content=<DiseasesPage tank={tank} onVisualInsight={()=>onNavigate("journal")}/>;break;
  case"timeline":content=<TimelinePage tank={tank}/>;break;
  case"journal":content=<JournalPage tank={tank}/>;break;
  case"waterchange":content=<WaterChangePage tank={tank}/>;break;
  case"feeding":content=<FeedingPage tank={tank}/>;break;
  case"dosing":content=<DosingPage tank={tank}/>;break;
  case"quarantine":content=<QuarantinePage tank={tank}/>;break;
  case"emergency":content=<EmergencyPage tank={tank}/>;break;
  case"rodi":content=<RODIPage tank={tank}/>;break;
  case"expenses":content=<ExpensesPage tank={tank}/>;break;
  case"alerts":content=<AlertsPage tank={tank}/>;break;
  case"reports":content=<ReportsPage tank={tank}/>;break;
  case"settings":content=<SettingsPage tank={tank}/>;break;
  case"academy":content=<AcademyPage onNavigate={onNavigate}/>;break;
  default:content=<AquaDashboardContent tank={tank} onNavigate={onNavigate}/>;
 }
 return <div className="page-help-wrap">
  {page==="dashboard"&&<CreatorContactStrip/>}
  {page!=="dashboard"&&page!=="academy"&&<AcademyShortcut page={page}/>}
  {content}
 </div>;
}
