export type DosingParameter = "KH" | "Ca" | "Mg";
export type DosingForm = "dry" | "stock" | "product";

export interface CompoundPreset {
  id: string;
  parameter: DosingParameter;
  ar: string;
  en: string;
  formula: string;
  gramsForDelta: (delta:number, volumeLiters:number) => number;
}

// Pure-compound stoichiometric presets. Product purity is applied separately.
// KH: 1 dKH = 0.357 meq/L.
const DKH_EQ_PER_L = 0.000357;
const MW_NAHCO3 = 84.0066;
const EQW_NA2CO3 = 105.9888 / 2;
const CA = 40.078;
const MG = 24.305;
const MW_CACL2 = 110.98;
const MW_CACL2_2H2O = 147.014;
const MW_MGCL2_6H2O = 203.303;
const MW_MGSO4_7H2O = 246.47;

export const DOSING_PRESETS: CompoundPreset[] = [
  {
    id:"nahco3",
    parameter:"KH",
    ar:"بيكربونات الصوديوم",
    en:"Sodium bicarbonate",
    formula:"NaHCO₃",
    gramsForDelta:(delta,volume)=>delta*DKH_EQ_PER_L*volume*MW_NAHCO3
  },
  {
    id:"na2co3",
    parameter:"KH",
    ar:"كربونات الصوديوم",
    en:"Sodium carbonate",
    formula:"Na₂CO₃",
    gramsForDelta:(delta,volume)=>delta*DKH_EQ_PER_L*volume*EQW_NA2CO3
  },
  {
    id:"cacl2-2h2o",
    parameter:"Ca",
    ar:"كلوريد الكالسيوم ثنائي الماء",
    en:"Calcium chloride dihydrate",
    formula:"CaCl₂·2H₂O",
    gramsForDelta:(delta,volume)=>(delta*volume/1000)/(CA/MW_CACL2_2H2O)
  },
  {
    id:"cacl2",
    parameter:"Ca",
    ar:"كلوريد الكالسيوم اللامائي",
    en:"Anhydrous calcium chloride",
    formula:"CaCl₂",
    gramsForDelta:(delta,volume)=>(delta*volume/1000)/(CA/MW_CACL2)
  },
  {
    id:"mgcl2-6h2o",
    parameter:"Mg",
    ar:"كلوريد المغنيسيوم سداسي الماء",
    en:"Magnesium chloride hexahydrate",
    formula:"MgCl₂·6H₂O",
    gramsForDelta:(delta,volume)=>(delta*volume/1000)/(MG/MW_MGCL2_6H2O)
  },
  {
    id:"mgso4-7h2o",
    parameter:"Mg",
    ar:"كبريتات المغنيسيوم سباعية الماء (ملح إنكليزي)",
    en:"Magnesium sulfate heptahydrate (Epsom salt)",
    formula:"MgSO₄·7H₂O",
    gramsForDelta:(delta,volume)=>(delta*volume/1000)/(MG/MW_MGSO4_7H2O)
  }
];

export interface DosingCalculationInput {
  parameter:DosingParameter;
  current:number;
  target:number;
  volumeLiters:number;
  form:DosingForm;
  presetId?:string;
  purityPercent?:number;
  stockGramsPerLiter?:number;
  productRaisePerMlPer100L?:number;
}

export interface DosingCalculationResult {
  delta:number;
  amount:number;
  unit:"g"|"mL";
  dryGrams?:number;
  steps:number;
  perStep:number;
  largeCorrection:boolean;
  valid:boolean;
  reason?:string;
}

const STEP_LIMIT:Record<DosingParameter,number>={KH:1,Ca:25,Mg:100};

export function calculateDose(input:DosingCalculationInput):DosingCalculationResult {
  const delta=Math.max(0,Number(input.target)-Number(input.current));
  const volume=Math.max(0,Number(input.volumeLiters));
  if(!Number.isFinite(delta)||!Number.isFinite(volume)||volume<=0||delta<=0){
    return {delta,amount:0,unit:input.form==="dry"?"g":"mL",steps:1,perStep:0,largeCorrection:false,valid:false,reason:"invalid-input"};
  }

  const steps=Math.max(1,Math.ceil(delta/STEP_LIMIT[input.parameter]));
  const largeCorrection=steps>1;

  if(input.form==="product"){
    const raise=Number(input.productRaisePerMlPer100L||0);
    if(!Number.isFinite(raise)||raise<=0)return {delta,amount:0,unit:"mL",steps,perStep:0,largeCorrection,valid:false,reason:"missing-product-strength"};
    const amount=(delta/raise)*(volume/100);
    return {delta,amount,unit:"mL",steps,perStep:amount/steps,largeCorrection,valid:true};
  }

  const preset=DOSING_PRESETS.find(x=>x.id===input.presetId&&x.parameter===input.parameter);
  if(!preset)return {delta,amount:0,unit:input.form==="dry"?"g":"mL",steps,perStep:0,largeCorrection,valid:false,reason:"missing-preset"};

  const purity=Math.min(100,Math.max(1,Number(input.purityPercent||100)))/100;
  const dryGrams=preset.gramsForDelta(delta,volume)/purity;

  if(input.form==="dry"){
    return {delta,amount:dryGrams,unit:"g",dryGrams,steps,perStep:dryGrams/steps,largeCorrection,valid:true};
  }

  const gramsPerLiter=Number(input.stockGramsPerLiter||0);
  if(!Number.isFinite(gramsPerLiter)||gramsPerLiter<=0)return {delta,amount:0,unit:"mL",dryGrams,steps,perStep:0,largeCorrection,valid:false,reason:"missing-stock-strength"};
  const ml=dryGrams/(gramsPerLiter/1000);
  return {delta,amount:ml,unit:"mL",dryGrams,steps,perStep:ml/steps,largeCorrection,valid:true};
}
