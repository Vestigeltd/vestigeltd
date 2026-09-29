import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const index=fs.readFileSync(path.join(root,"public","index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"public","corporate-v35.30.2.css"),"utf8");
const svg=fs.readFileSync(path.join(root,"public","assets","vestige-capability-scale-v35.34.5.svg"),"utf8");
const failures=[];

function need(condition,message){ if(!condition) failures.push(message); }

need(index.includes('/assets/vestige-capability-scale-v35.34.5.svg'),"homepage does not load the locked SVG asset");
need(index.includes('/corporate-v35.30.2.css?v=35.34.5'),"V35.34.5 presentation cache key missing");
need(index.includes('/responsive-system.css?v=35.34.0'),"responsive system reference lost");
need(!index.includes('id="vestigeScaleAssembly"'),"experimental inline scale remains in homepage HTML");

need(svg.includes('viewBox="0 0 1044 310"'),"approved user-space is not locked");
need(svg.includes('preserveAspectRatio="xMidYMid meet"'),"uniform aspect-ratio scaling is not locked");
need(svg.includes('id="vestigeScaleAssembly"'),"master assembly group missing");

need(svg.includes('x1="83.52" y1="67"'),"approved overhead beam origin missing");
need(svg.includes('x2="960.48" y2="67"'),"approved overhead beam terminus missing");

need(svg.includes('cx="191.5" cy="66.5"'),"Product suspension joint missing");
need(svg.includes('x1="191.5" y1="67" x2="191.5" y2="156"'),"Product vertical suspension cable missing");
need(svg.includes('x="0" y="156" width="383" height="98"'),"Product node geometry changed");

need(svg.includes('cx="852.5" cy="66.5"'),"Service suspension joint missing");
need(svg.includes('x1="852.5" y1="67" x2="852.5" y2="156"'),"Service vertical suspension cable missing");
need(svg.includes('x="661" y="156" width="383" height="98"'),"Service node geometry changed");

need(svg.includes('x1="522" y1="6"'),"central datum origin changed");
need(svg.includes('x2="522" y2="256"'),"central datum terminus changed");
need(svg.includes('transform="rotate(45 522 67)"'),"beam registration diamond changed");
need(svg.includes('transform="translate(427 24) scale(1.1875)"'),"approved crosshair placement changed");
need(svg.includes('x="486" y="77.5" width="72" height="83"'),"approved shield dimensions changed");

need(svg.includes('M484 177 L560 177 L522 239 Z'),"upper production pedestal triangle missing");
need(svg.includes('M522 239 L484 311 L560 311 Z'),"lower production pedestal triangle missing");
need(svg.includes('x1="474" y1="305" x2="570" y2="305"'),"production pedestal base missing");
need(svg.includes('x="522" y="292"'),"Vestige Standard caption registration changed");

need(!svg.includes('vector-effect="non-scaling-stroke"'),"non-scaling strokes would break proportional artwork scaling");
need(!/position\s*:/i.test(svg),"SVG asset contains CSS positioning");

need(css.includes('width:min(100%,1080px)'),"approved outer artwork width missing");
need(css.includes('aspect-ratio:1044 / 310'),"locked SVG aspect ratio missing");
const artworkRule = css.match(/\.corporate-home \.avenue-standard-artwork\{([^}]*)\}/s);
need(Boolean(artworkRule),"outer artwork rule missing");
need(!artworkRule || !/transform\s*:/i.test(artworkRule[1]),"outer artwork must not use transforms");

if(failures.length){
  console.error("V35.34.5 REFERENCE LOCK FAILED");
  failures.forEach(f=>console.error(" - "+f));
  process.exit(1);
}

console.log("V35.34.5 REFERENCE LOCK PASS");
console.log("Owner-approved beam-above / cables-down geometry: PASS");
console.log("Product and Service nodes: PASS");
console.log("Centred fulcrum / diamond / shield: PASS");
console.log("Production two-triangle pedestal: PASS");
console.log("One immutable SVG asset: PASS");
console.log("Uniform desktop/mobile scaling: PASS");
console.log("No internal responsive reflow: PASS");
