"use client";
import type { ReactNode } from "react";
import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { AquaDashboardContent } from "@/components/dashboard/AquaDashboardContent";
import { PageHelpButton } from "@/components/help/HelpCenter";
import { CreatorContactStrip } from "@/components/CreatorContactStrip";
import { TanksPage } from "./TanksPage";
import { EquipmentPage } from "./EquipmentPage";
import { SumpPage } from "./SumpPage";
import { LivestockPage } from "./LivestockPage";
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

export function PageRouter({page,tank,tanks,selectedTankId,onSelectTank,onNavigate}:{page:AppPage;tank:Tank;tanks:Tank[];selectedTankId:string;onSelectTank:(id:string)=>void;onNavigate:(p:AppPage)=>void}) {
 let content:ReactNode;
 switch(page){
  case"tanks":content=<TanksPage tanks={tanks} selectedTankId={selectedTankId} onSelect={onSelectTank}/>;break;
  case"equipment":content=<EquipmentPage tank={tank}/>;break;
  case"sump":content=<SumpPage tank={tank}/>;break;
  case"livestock":content=<LivestockPage tank={tank} onLibrary={()=>onNavigate("library")}/>;break;
  case"acclimation":content=<AcclimationPage tank={tank}/>;break;
  case"library":content=<LibraryPage tank={tank}/>;break;
  case"chemistry":content=<ChemistryPage tank={tank}/>;break;
  case"maintenance":content=<MaintenancePage tank={tank}/>;break;
  case"inventory":content=<InventoryPage tank={tank}/>;break;
  case"diseases":content=<DiseasesPage tank={tank}/>;break;
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
  default:content=<AquaDashboardContent tank={tank} onNavigate={onNavigate}/>;
 }
 return <div className="page-help-wrap">
  <PageHelpButton page={page}/>
  {page==="dashboard"&&<CreatorContactStrip/>}
  {content}
 </div>;
}
