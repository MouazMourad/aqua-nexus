"use client";

import { AquaDashboard } from "@/components/dashboard/AquaDashboard";
import { DashboardCommandLayer } from "@/components/dashboard/DashboardCommandLayer";
import { DashboardHealthPulse } from "@/components/dashboard/DashboardHealthPulse";

export default function Home() {
  return <><AquaDashboard/><DashboardCommandLayer/><DashboardHealthPulse/></>;
}
