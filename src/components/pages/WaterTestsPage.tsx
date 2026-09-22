"use client";

import { useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { Modal } from "@/components/ui/Modal";
import { latestMeasuredChemistryReading,validateChemistryValues } from "@/domain/chemistryDataQuality";

type WaterTestValues = Record<string, number>;

export function WaterTestsPage({ tank }: { tank: Tank }) {
  const addReading = useAquaStore((s) => s.addChemistryReading);
  const [open, setOpen] = useState(false);
  const latest = latestMeasuredChemistryReading(tank)?.values ?? {};
  const initial: WaterTestValues = tank.type === "marine"
    ? { temperature: 25, pH: 8.1, salinity: 1.025, KH: 8, Ca: 430, Mg: 1320, NO3: 10, PO4: 0.08 }
    : { temperature: 25, pH: 7.2, GH: 8, KH: 5, NO3: 15 };
  const [values, setValues] = useState<WaterTestValues>(() => ({ ...initial }));

  function save() {
    const issues=validateChemistryValues(tank,values);
    if(issues.length){window.alert(issues[0].ar);return}
    addReading(tank.id, { timestamp: new Date().toISOString(), values });
    setOpen(false);
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <div><small>WATER CHEMISTRY</small><h2>فحوص المياه</h2></div>
        <button type="button" className="btn primary" onClick={() => setOpen(true)}>+ تسجيل فحص</button>
      </div>
      <div className="chemistry-large-grid full-span">
        {Object.entries(latest).map(([key, value]) => <article className="chem-card" key={key}><small>{key}</small><b>{value ?? "—"}</b><span className="chem-status">آخر قراءة</span></article>)}
      </div>
      <Modal open={open} title="تسجيل فحص مياه" onClose={() => setOpen(false)}>
        <div className="form-grid">
          {Object.entries(values).map(([key, value]) => <label className="field" key={key}><span>{key}</span><input type="number" step="any" value={value} onChange={(e) => setValues(v => ({ ...v, [key]: Number(e.target.value) }))} /></label>)}
        </div>
        <div className="modal-actions"><button type="button" className="btn" onClick={() => setOpen(false)}>إلغاء</button><button type="button" className="btn primary" onClick={save}>حفظ الفحص</button></div>
      </Modal>
    </section>
  );
}
