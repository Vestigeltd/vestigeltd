import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const css=fs.readFileSync(path.join(root,"public","styles.css"),"utf8").replace(/\r\n/g,"\n");
const failures=[];

function need(condition,message){
  if(!condition) failures.push(message);
}

need(css.includes("/* V35.34.12 — consolidated responsive layout corrections"),"V35.34.12 consolidated layout block missing");
need(!css.includes("/* V35.34.9 — current-main repair layer */"),"legacy V35.34.9 repair layer remains");
need(!css.includes("/* V35.34.11 — precise layout correction"),"legacy V35.34.11 repair layer remains");

need(css.includes("--vcjs-rail-width:clamp(96px,calc((100vw - 780px)/2),260px);"),"checkout rail sizing rule missing");
need(css.includes("--vcjs-center-width:min("),"checkout centre-width custom property missing");
need(css.includes("grid-template-columns:\n      var(--vcjs-rail-width)\n      minmax(0,var(--vcjs-center-width))\n      var(--vcjs-rail-width);"),"checkout rails are not registered around the centre column");
need(css.includes(".checkout-shell{\n    width:var(--vcjs-center-width);"),"checkout form is not constrained to the available centre column");
need(css.includes(".checkout-shell .order-form{\n    width:100%;\n    min-width:0;"),"checkout form does not explicitly prevent intrinsic-width overflow");

need(css.includes(".contact-card-stage{\n  min-height:432px;"),"desktop contact-card stage has not been reduced by the intended 1cm-equivalent from the 470px baseline");
need(css.includes(".contact-action-stack{\n  width:min(100%,300px);\n  gap:40px;"),"contact actions are not using the revised vertical spacing");
need(css.includes(".contact-action-stack .btn{\n  width:100%;\n  min-height:44px;"),"contact action targets do not preserve an accessible minimum target height");

need(css.includes("#vestigeCart{\n  width:100%;\n  max-width:900px;"),"basket container width constraint missing");
need(css.includes("#vestigeCart .cart-columns,\n#vestigeCart .cart-row,\n#vestigeCart .cart-delivery-row{\n  width:100%;\n  min-width:0;"),"basket rows are not explicitly constrained to the form width");
need(css.includes("#vestigeCart .cart-remove{\n  justify-self:end;"),"basket Remove control alignment rule missing");

need(css.includes("padding-top:26px;"),"desktop hero top-spacing correction missing");
need(css.includes("padding-top:16px;"),"mobile hero top-spacing correction missing");

if(failures.length){
  console.error("V35.34.12 LAYOUT GOVERNANCE FAILED");
  failures.forEach(f=>console.error(" - "+f));
  process.exit(1);
}

console.log("V35.34.12 LAYOUT GOVERNANCE PASS");
console.log("Consolidated responsive layout rules: PASS");
console.log("Checkout centre column / blue rail registration: PASS");
console.log("Basket width and Remove alignment constraints: PASS");
console.log("Contact proportions and action spacing: PASS");
console.log("Accessible action target minimums: PASS");
console.log("Hero top-spacing correction: PASS");
