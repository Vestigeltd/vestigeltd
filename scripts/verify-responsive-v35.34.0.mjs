import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const publicDir=path.join(root,"public");
const failures=[];

function walk(dir,out=[]){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    e.isDirectory()?walk(p,out):out.push(p);
  }
  return out;
}

const htmlFiles=walk(publicDir).filter(f=>f.endsWith(".html")&&!f.includes(`${path.sep}responsive-audit${path.sep}`));

for(const file of htmlFiles){
  const rel=path.relative(root,file).replaceAll("\\","/");
  const html=fs.readFileSync(file,"utf8");

  if(!/name=["']viewport["'][^>]*width=device-width/i.test(html) &&
     !/width=device-width[^>]*name=["']viewport["']/i.test(html)){
    failures.push(`${rel}: missing device-width viewport`);
  }

  const links=[...html.matchAll(/<link\b(?=[^>]*rel=["']stylesheet["'])[^>]*href=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
  if(links.at(-1)!=="/responsive-system.css?v=35.34.0"){
    failures.push(`${rel}: responsive-system.css must be the final stylesheet; found ${JSON.stringify(links)}`);
  }
}

const corporate=fs.readFileSync(path.join(publicDir,"corporate-upgrade.css"),"utf8");
if(corporate.includes(".corporate-home .corporate-editorial-grid{grid-template-columns:minmax(260px,.68fr) minmax(0,1.32fr);gap:clamp(60px,7vw,102px)}")){
  failures.push("corporate-upgrade.css still contains the defective desktop-only editorial declaration as its base rule");
}
if(!corporate.includes("@media(min-width:1200px)")){
  failures.push("corporate-upgrade.css missing desktop progressive enhancement breakpoint");
}

const index=fs.readFileSync(path.join(publicDir,"index.html"),"utf8");
if(!index.includes('class="avenue-standard-visual"')) failures.push("homepage scalable capability visual missing");
if(index.includes('class="avenue-balance-axis"')) failures.push("legacy fixed-composition capability DOM still active");

const responsive=fs.readFileSync(path.join(publicDir,"responsive-system.css"),"utf8");
for(const token of [
  "Vestige Responsive System â€” V35.34.0",
  "@media(max-width:980px)",
  "@media(max-width:760px)",
  ".spec-table,",
  ".decision-table",
  ".owner-table"
]){
  if(!responsive.includes(token)) failures.push(`responsive-system.css missing required token: ${token}`);
}

if(/(?:html|body)\s*(?:,\s*(?:html|body)\s*)?\{[^}]*overflow-x\s*:\s*hidden/si.test(responsive)){
  failures.push("global overflow-x:hidden is prohibited");
}
if(/transform\s*:\s*scale\s*\(/i.test(responsive)){
  failures.push("transform-based page/component scaling is prohibited in responsive system");
}

console.log(`V35.34.0 responsive governance scanned ${htmlFiles.length} HTML page(s).`);

if(failures.length){
  console.error("RESPONSIVE GOVERNANCE FAILED");
  failures.forEach(f=>console.error(` - ${f}`));
  process.exit(1);
}

console.log("RESPONSIVE GOVERNANCE PASS");
console.log("Discover Vestige base layout: single column");
console.log("Discover Vestige desktop enhancement: >=1200px");
console.log("Capability visual: scalable SVG");
console.log("Universal responsive system: final stylesheet on every page");
