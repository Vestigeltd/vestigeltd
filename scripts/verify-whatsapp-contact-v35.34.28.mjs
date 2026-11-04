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
    else if (/\\.(html|js|css|json|txt|svg|xml)$/i.test(entry.name)) files.push(full);
  }
  return files;
}

const publicFiles = collectTextFiles("public");
const publicText = publicFiles.map(read).join("\\n");
const checks = [
  [pkg.version === "35.34.28", "Package version is 35.34.28"],
  [!contact.includes('href="/whatsapp"') && !contact.includes("Chat on WhatsApp"), "Contact page has no direct WhatsApp chat link"],
  [contact.includes('contact-whatsapp-qr-link') && contact.includes('src="/assets/vestige-whatsapp-qr.png"') && contact.includes("Open WhatsApp QR full size"), "WhatsApp QR code and full-size option remain available"],
  [contact.includes("Scan the Vestige Ltd QR code with the WhatsApp camera"), "Contact page explains QR-only WhatsApp contact"],
  [!contact.includes("wa.me/"), "Contact HTML does not expose a direct WhatsApp destination"],
  [!publicText.includes('href="/whatsapp"') && !publicText.includes("VESTIGE_WHATSAPP_NUMBER") && !publicText.includes("wa.me/"), "Public assets contain no direct WhatsApp chat route or destination"],
  [!worker.includes('url.pathname === "/whatsapp"'), "Worker has no /whatsapp redirect endpoint"],
  [!worker.includes("VESTIGE_WHATSAPP_NUMBER") && !worker.includes("https://wa.me/"), "Worker has no WhatsApp number secret binding or redirect target"],
  [!pkg.scripts?.["preview:whatsapp-secret"] && !pkg.scripts?.["preview:secrets"], "Unused WhatsApp preview secret commands are removed"]
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("\\nWhatsApp QR-only contact verification PASSED.");
