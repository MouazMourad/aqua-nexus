import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile-hotfix.css";
import "./aqua-ai.css";
import "./aqua-ai-v2.css";
import "./ai-workflows.css";
import "./ticker-rtl-fix.css";
import "./tank-swipe.css";
import "./intelligence.css";
import { PWARegister } from "@/components/PWARegister";
import { PushReminderSync } from "@/components/PushReminderSync";
import { CloudSyncBridge } from "@/components/CloudSyncBridge";

export const metadata: Metadata = {
  title: "Aqua Nexus 3D",
  description: "Smart Aquarium Management Platform",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#03121c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body><PWARegister/><PushReminderSync/><CloudSyncBridge/>{children}</body>
    </html>
  );
}
