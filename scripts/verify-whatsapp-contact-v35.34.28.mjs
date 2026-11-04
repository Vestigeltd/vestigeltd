import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(file, "utf8");
const contact = read("public/contact.html");
const worker = read("src/worker.js");
const pkg = JSON.parse(read("package.json"));

function collectTextFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectTextFiles(full));
    else if (/\.(html|js|css|json|txt|svg|xml)$/i.test(entry.name)) files.push(full);
  }
  return files;
}

const publicFiles = collectTextFiles("public");
const publicText = publicFiles.map(read).join("\\n");
const checks = [
  [pkg.scripts?.preview === "wrangler preview", "Preview command uses isolated branch Worker Previews, not production-resource Version URLs"],
  [pkg.scripts?.["preview:whatsapp-secret"] === "wrangler preview secret put VESTIGE_WHATSAPP_NUMBER", "WhatsApp secret setup targets the current branch Preview"],
  [pkg.scripts?.["preview:secrets"] === "wrangler preview secret list", "Preview secret listing is scoped to the current branch Preview"],
  [pkg.version === "35.34.28", "Package version is 35.34.28"],
  [contact.includes('href="/whatsapp"') && contact.includes("Chat on WhatsApp"), "Contact page exposes a direct-chat button through the private Worker route"],
  [!contact.includes("wa.me/"), "Contact HTML does not expose a direct WhatsApp destination"],
  [!publicText.includes("VESTIGE_WHATSAPP_NUMBER") && !publicText.includes("wa.me/"), "Public assets contain no WhatsApp secret binding or direct chat destination"],
  [worker.includes('if (url.pathname === "/whatsapp")'), "Worker handles the private WhatsApp redirect route"],
  [worker.includes("env.VESTIGE_WHATSAPP_NUMBER"), "Worker reads the WhatsApp number from a secret binding"],
  [worker.includes('.replace(/\\D/g, "")') && worker.includes('/^\\d{8,15}$/'), "Worker normalises and validates international number format"],
  [worker.includes('https://wa.me/${whatsappNumber}'), "Worker redirects to WhatsApp without publishing the destination in public assets"],
  [worker.includes('WhatsApp contact is temporarily unavailable.') && worker.includes('status: 503'), "Worker fails closed when the secret is missing or invalid"],
  [worker.includes('whatsappRedirect.headers.set("Cache-Control", "no-store")') && worker.includes('whatsappRedirect.headers.set("Referrer-Policy", "no-referrer")'), "WhatsApp redirect is non-cacheable and suppresses referrer leakage"]
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("\\nWhatsApp contact privacy verification PASSED.");
