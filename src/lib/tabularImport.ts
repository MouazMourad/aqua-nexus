export type TableRow=Record<string,string>;

function detectDelimiter(line:string){
  const counts=[
    {d:"\t",n:(line.match(/\t/g)||[]).length},
    {d:";",n:(line.match(/;/g)||[]).length},
    {d:",",n:(line.match(/,/g)||[]).length}
  ].sort((a,b)=>b.n-a.n);
  return counts[0].n>0?counts[0].d:",";
}

function parseLine(line:string,delimiter:string){
  const out:string[]=[];let cell="",quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted&&line[i+1]==='"'){cell+='"';i++;continue;}
      quoted=!quoted;continue;
    }
    if(ch===delimiter&&!quoted){out.push(cell.trim());cell="";continue;}
    cell+=ch;
  }
  out.push(cell.trim());
  return out;
}

export function parseDelimitedText(text:string):{headers:string[];rows:TableRow[]}{
  const clean=text.replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n");
  const lines=clean.split("\n").filter(x=>x.trim().length>0);
  if(lines.length<2)return{headers:[],rows:[]};
  const delimiter=detectDelimiter(lines[0]);
  const headers=parseLine(lines[0],delimiter).map(h=>h.trim());
  const rows=lines.slice(1).map(line=>{
    const values=parseLine(line,delimiter),row:TableRow={};
    headers.forEach((h,i)=>row[h]=values[i]??"");
    return row;
  }).filter(row=>Object.values(row).some(Boolean));
  return{headers,rows};
}

function escapeCell(value:unknown,delimiter:string){
  const s=String(value??"");
  return s.includes('"')||s.includes("\n")||s.includes(delimiter)?`"${s.replace(/"/g,'""')}"`:s;
}

export function buildDelimitedText(headers:string[],rows:(Record<string,unknown>)[],delimiter=","){
  return [headers.join(delimiter),...rows.map(row=>headers.map(h=>escapeCell(row[h],delimiter)).join(delimiter))].join("\n");
}

export function downloadDelimitedFile(filename:string,text:string,mime="text/csv;charset=utf-8"){
  const blob=new Blob(["\uFEFF",text],{type:mime});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

export function field(row:TableRow,name:string){
  const key=Object.keys(row).find(k=>k.trim().toLowerCase()===name.trim().toLowerCase());
  return key?row[key].trim():"";
}

export function numberField(row:TableRow,name:string){
  const raw=field(row,name);
  if(!raw)return null;
  const normalized=raw.includes(",")&&!raw.includes(".")?raw.replace(",","."):raw;
  const n=Number(normalized);
  return Number.isFinite(n)?n:null;
}
