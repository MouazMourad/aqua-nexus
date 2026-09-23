import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aquanexus.app",
  appName: "Aqua Nexus",
  webDir: "out",
  ios: {
    contentInset: "automatic"
  }
};

export default config;
