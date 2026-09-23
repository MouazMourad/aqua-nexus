import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile-hotfix.css";
import "./aqua-ai.css";
import "./aqua-ai-v2.css";
import "./ai-workflows.css";
import "./ticker-rtl-fix.css";
import "./tank-swipe.css";
import "./intelligence.css";
import "./help-center.css";
import { PWARegister } from "@/components/PWARegister";
import { PushReminderSync } from "@/components/PushReminderSync";
import { CloudSyncBridge } from "@/components/CloudSyncBridge";
import { DashboardCommandCollapse } from "@/components/dashboard/DashboardCommandCollapse";
import { PhotoStorageBridge } from "@/components/PhotoStorageBridge";
import { DocumentLocaleSync } from "@/components/DocumentLocaleSync";
import { DataSafetyBanner } from "@/components/DataSafetyBanner";
import { MultiTabGuard } from "@/components/MultiTabGuard";

export const metadata: Metadata = {
  title: "Aqua Nexus",
  description: "Smart Aquarium Management Platform",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
      <body><DocumentLocaleSync/><MultiTabGuard/><DataSafetyBanner/><PWARegister/><PushReminderSync/><CloudSyncBridge/><PhotoStorageBridge/><DashboardCommandCollapse/>{children}</body>
    </html>
  );
}
