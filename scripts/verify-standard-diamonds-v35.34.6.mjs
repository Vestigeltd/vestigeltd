import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const css=fs.readFileSync(path.join(root,"public","site-system-v35.30.17.css"),"utf8");
const index=fs.readFileSync(path.join(root,"public","index.html"),"utf8");
const failures=[];

function need(v,msg){ if(!v) failures.push(msg); }

need(index.includes('/assets/vestige-capability-scale-v35.34.5.svg'),"approved V35.34.5 scale asset was changed");
need(index.includes('site-system-v35.30.17.css?v=35.34.6'),"homepage shared stylesheet cache key not bumped");
need(index.includes('<span>CLARITY</span><i aria-hidden="true"></i>'),"CLARITY separator markup changed");
need(index.includes('<span>DISCIPLINE</span><i aria-hidden="true"></i>'),"DISCIPLINE separator markup changed");
need(index.includes('<span>PRECISION</span><i aria-hidden="true"></i>'),"PRECISION separator markup changed");

need(css.includes('grid-template-columns:max-content 14px max-content 14px max-content 14px max-content;'),"desktop separator columns are not registered");
need(css.includes('.corporate-home .corporate-values-line i::before{'),"outlined diamond pseudo-element missing");
need(css.includes('background:var(--vestige-gold);'),"filled gold diamond missing");
need(css.includes('border:2px solid #00101f;'),"desktop navy diamond border missing");
need(css.includes('rotate(45deg)'),"diamond rotation missing");
need(css.includes('grid-template-columns:max-content 12px max-content 12px max-content 12px max-content;'),"mobile separator columns are not registered");
need(css.includes('border-width:1.5px;'),"mobile diamond outline scaling missing");

const valuesRule = css.match(/\.corporate-home \.corporate-values-line i\{([\s\S]*?)\}/);
need(Boolean(valuesRule),"values separator base rule missing");
need(!valuesRule || !valuesRule[1].includes('clip-path:polygon'),"legacy filled clip-path diamond still active");
need(!valuesRule || !valuesRule[1].includes('background:#00101f'),"legacy empty navy separator still active");

if(failures.length){
  console.error("V35.34.6 STANDARD DIAMONDS FAILED");
  failures.forEach(f=>console.error(" - "+f));
  process.exit(1);
}

console.log("V35.34.6 STANDARD DIAMONDS PASS");
console.log("Existing semantic separator markup preserved: PASS");
console.log("Filled gold / navy-border diamond: PASS");
console.log("Desktop alignment: PASS");
console.log("Mobile proportional sizing: PASS");
console.log("V35.34.5 scale artwork untouched: PASS");
