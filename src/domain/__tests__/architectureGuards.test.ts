import { describe,expect,it } from "vitest";
import { readFileSync,readdirSync } from "node:fs";
import { join,relative } from "node:path";

function filesUnder(root:string):string[]{
  const out:string[]=[];
  for(const name of readdirSync(root,{withFileTypes:true})){
    const path=join(root,name.name);
    if(name.isDirectory()){
      if(name.name==="__tests__")continue;
      out.push(...filesUnder(path));
    }else if(/\.(ts|tsx)$/.test(name.name))out.push(path);
  }
  return out;
}

describe("architecture safety guards",()=>{
  it("forbids decision-facing direct chemistry array access",()=>{
    const roots=["src/domain","src/components","src/lib"];
    const offenders:string[]=[];
    for(const root of roots)for(const file of filesUnder(root)){
      const text=readFileSync(file,"utf8");
      if(/\.chemistry\s*\[\s*[01]\s*\]/.test(text))offenders.push(relative(process.cwd(),file));
    }
    expect(offenders).toEqual([]);
  });

  it("forbids UTC ISO slicing as a substitute for local calendar today",()=>{
    const roots=["src/domain","src/components","src/lib"];
    const offenders:string[]=[];
    for(const root of roots)for(const file of filesUnder(root)){
      const text=readFileSync(file,"utf8");
      if(/new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/.test(text))offenders.push(relative(process.cwd(),file));
    }
    expect(offenders).toEqual([]);
  });
});
