"use client";
import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { AquaDashboardContent } from "@/components/dashboard/AquaDashboardContent";
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
 switch(page){
  case"tanks":return <TanksPage tanks={tanks} selectedTankId={selectedTankId} onSelect={onSelectTank}/>;
  case"equipment":return <EquipmentPage tank={tank}/>;
  case"sump":return <SumpPage tank={tank}/>;
  case"livestock":return <LivestockPage tank={tank} onLibrary={()=>onNavigate("library")}/>;
  case"acclimation":return <AcclimationPage tank={tank}/>;
  case"library":return <LibraryPage tank={tank}/>;
  case"chemistry":return <ChemistryPage tank={tank}/>;
  case"maintenance":return <MaintenancePage tank={tank}/>;
  case"inventory":return <InventoryPage tank={tank}/>;
  case"diseases":return <DiseasesPage tank={tank}/>;
  case"timeline":return <TimelinePage tank={tank}/>;
  case"journal":return <JournalPage tank={tank}/>;
  case"waterchange":return <WaterChangePage tank={tank}/>;
  case"feeding":return <FeedingPage tank={tank}/>;
  case"dosing":return <DosingPage tank={tank}/>;
  case"quarantine":return <QuarantinePage tank={tank}/>;
  case"emergency":return <EmergencyPage tank={tank}/>;
  case"rodi":return <RODIPage tank={tank}/>;
  case"expenses":return <ExpensesPage tank={tank}/>;
  case"alerts":return <AlertsPage tank={tank}/>;
  case"reports":return <ReportsPage tank={tank}/>;
  case"settings":return <SettingsPage tank={tank}/>;
  default:return <AquaDashboardContent tank={tank} onNavigate={onNavigate}/>;
 }
}
