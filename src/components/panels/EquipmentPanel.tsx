import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
const glyph:Record<string,string>={lighting:"◫",waveMaker:"◉",skimmer:"♙",returnPump:"◈",heater:"▯",turfScrubber:"▤",refugiumLight:"▥",ozone:"◌",reactor:"◎",doser:"◍"};
export function EquipmentPanel({tank}:{tank:Tank}) {
  const lang=useAquaStore(s=>s.language);
  return <section className="card panel"><h3>{tr(lang,"equipment")}</h3><div className="equipment-list">{tank.equipment.slice(0,10).map(e=><div className="eq-row" key={e.id}><span className="eq-icon">{glyph[e.kind]??"⚙"}</span><div><b>{e.name}</b><small>{e.brand??""} {e.model??""}</small></div><span className="status">{e.status}</span></div>)}</div></section>;
}
