"use client";
import type { EquipmentKind,Tank } from "@/domain/types";
import { Modal } from "@/components/ui/Modal";
import { tr,bi } from "@/i18n";

export const EQUIPMENT_KINDS:EquipmentKind[]=["lighting","waveMaker","overflow","skimmer","returnPump","filterSock","rollerFilter","reactor","heater","doser","uv","ozone","ato","refugiumLight","turfScrubber","probe","co2","other"];

export function EquipmentAddModal(props:{
  open:boolean;lang:"ar"|"en";tank:Tank;name:string;kind:EquipmentKind;location:string;brand:string;model:string;days:number;power:number;hours:number;ratedVolume:number;flowLph:number;par:number;coverageLength:number;coverageWidth:number;
  onClose:()=>void;onSave:()=>void;
  setName:(v:string)=>void;setKind:(v:EquipmentKind)=>void;setLocation:(v:string)=>void;setBrand:(v:string)=>void;setModel:(v:string)=>void;setDays:(v:number)=>void;setPower:(v:number)=>void;setHours:(v:number)=>void;setRatedVolume:(v:number)=>void;setFlowLph:(v:number)=>void;setPar:(v:number)=>void;setCoverageLength:(v:number)=>void;setCoverageWidth:(v:number)=>void;
}){
 const p=props;
 return <Modal open={p.open} title={tr(p.lang,"addEquipment")} onClose={p.onClose}>
  <div className="form-grid">
   <label className="field"><span>{tr(p.lang,"name")}</span><input value={p.name} onChange={e=>p.setName(e.target.value)}/></label>
   <label className="field"><span>{tr(p.lang,"type")}</span><select value={p.kind} onChange={e=>p.setKind(e.target.value as EquipmentKind)}>{EQUIPMENT_KINDS.map(k=><option key={k}>{k}</option>)}</select></label>
   <label className="field"><span>{tr(p.lang,"location")}</span><select value={p.location} onChange={e=>p.setLocation(e.target.value)}><option value="display">{bi(p.lang,"الحوض الرئيسي","Display Tank")}</option><option value="external">{bi(p.lang,"خارجي","External")}</option>{p.tank.sump.chambers.map(c=><option key={c.id} value={`sump:${c.id}`}>{p.lang==="ar"?c.name:(c.nameEn||c.name)}</option>)}</select></label>
   <label className="field"><span>{tr(p.lang,"brandLabel")}</span><input value={p.brand} onChange={e=>p.setBrand(e.target.value)}/></label>
   <label className="field"><span>{tr(p.lang,"model")}</span><input value={p.model} onChange={e=>p.setModel(e.target.value)}/></label>
   <label className="field"><span>{tr(p.lang,"serviceInterval")}</span><input type="number" value={p.days} onChange={e=>p.setDays(Number(e.target.value))}/></label>
   <label className="field"><span>{bi(p.lang,"القدرة W","Power W")}</span><input type="number" min="0" value={p.power||""} onChange={e=>p.setPower(Number(e.target.value))}/></label>
   <label className="field"><span>{bi(p.lang,"ساعات التشغيل / يوم","Hours / day")}</span><input type="number" min="0" max="24" step=".1" value={p.hours||""} onChange={e=>p.setHours(Number(e.target.value))}/></label>
   <label className="field"><span>{bi(p.lang,"التدفق L/h","Flow L/h")}</span><input type="number" min="0" value={p.flowLph||""} onChange={e=>p.setFlowLph(Number(e.target.value))}/></label>
   <label className="field"><span>{bi(p.lang,"الحجم المصنف L","Rated volume L")}</span><input type="number" min="0" value={p.ratedVolume||""} onChange={e=>p.setRatedVolume(Number(e.target.value))}/></label>
   {p.kind==="lighting"&&<><label className="field"><span>PAR {bi(p.lang,"عند عمق الكائنات","at livestock depth")}</span><input type="number" min="0" value={p.par||""} onChange={e=>p.setPar(Number(e.target.value))}/></label><label className="field"><span>{bi(p.lang,"تغطية الطول cm","Coverage length cm")}</span><input type="number" min="0" value={p.coverageLength||""} onChange={e=>p.setCoverageLength(Number(e.target.value))}/></label><label className="field"><span>{bi(p.lang,"تغطية العرض cm","Coverage width cm")}</span><input type="number" min="0" value={p.coverageWidth||""} onChange={e=>p.setCoverageWidth(Number(e.target.value))}/></label></>}
  </div>
  <div className="inline-alert info">{bi(p.lang,"الموقع المقترح يتغير تلقائياً حسب نوع الجهاز. Flow وRated Volume وPAR بيانات اختيارية لكنها تحسن دقة تقييم التجهيزات.","Suggested location changes by equipment type. Flow, rated volume and PAR are optional but improve adequacy assessment.")}</div>
  <div className="modal-actions"><button className="btn" onClick={p.onClose}>{tr(p.lang,"cancel")}</button><button className="btn primary" onClick={p.onSave}>{tr(p.lang,"save")}</button></div>
 </Modal>;
}
