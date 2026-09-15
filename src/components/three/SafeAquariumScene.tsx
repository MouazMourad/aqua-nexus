"use client";

import React, { useEffect, useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { AquariumScene } from "./AquariumScene";

class SceneErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Aqua Nexus 3D scene failed:", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SceneFallback({ lang }: { lang: "ar" | "en" }) {
  return (
    <div
      className="aquarium-scene-wrap"
      style={{
        minHeight: 420,
        display: "grid",
        placeItems: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div className="card panel" style={{ maxWidth: 440 }}>
        <h3>{lang === "ar" ? "العرض ثلاثي الأبعاد غير متاح على هذا الجهاز" : "3D view is unavailable on this device"}</h3>
        <p className="note">
          {lang === "ar"
            ? "بقية Aqua Nexus تعمل بشكل طبيعي. حدّث Chrome أو فعّل تسريع الرسوميات/WebGL2 للحصول على المجسم ثلاثي الأبعاد."
            : "The rest of Aqua Nexus remains available. Update Chrome or enable graphics acceleration/WebGL2 to use the 3D digital twin."}
        </p>
      </div>
    </div>
  );
}

export function SafeAquariumScene({ tank, view = "system" }: { tank: Tank; view?: "system" | "display" }) {
  const lang = useAquaStore((s) => s.language);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const webgl2 = canvas.getContext("webgl2");
      const modernArray = typeof Array.prototype.at === "function";
      setSupported(Boolean(webgl2) && modernArray);
    } catch {
      setSupported(false);
    }
  }, []);

  if (supported === null) {
    return <div className="aquarium-scene-wrap" style={{ minHeight: 420 }} />;
  }

  const fallback = <SceneFallback lang={lang} />;
  if (!supported) return fallback;

  return (
    <SceneErrorBoundary fallback={fallback}>
      <AquariumScene tank={tank} view={view} />
    </SceneErrorBoundary>
  );
}
