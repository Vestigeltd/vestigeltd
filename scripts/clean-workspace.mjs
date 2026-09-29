import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checkOnly = process.argv.includes("--check");
const publicDir = path.join(root, "public");

const exists = p => fs.existsSync(p);
const rel = p => path.relative(root, p).replaceAll("\\", "/");

const remove = p => {
  if (!exists(p)) return false;
  if (checkOnly) return true;
  fs.rmSync(p, { recursive: true, force: true });
  return true;
};

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(full);
  }
}
walk(publicDir);

const referencedCss = new Set();

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  for (const m of html.matchAll(/\/(site-system-v35\.30\.\d+\.css)(?:\?[^"' >]*)?/g)) {
    referencedCss.add(m[1]);
  }
}

/* Follow stylesheet imports as dependencies too. A CSS file referenced by
   another stylesheet must never be treated as disposable workspace clutter. */
for (const name of fs.readdirSync(publicDir)) {
  if (!name.endsWith(".css")) continue;
  const file = path.join(publicDir, name);
  const css = fs.readFileSync(file, "utf8");
  for (const m of css.matchAll(/@import\s+(?:url\()?["']?\/?(site-system-v35\.30\.\d+\.css)(?:\?[^"')\s;]*)?["']?\)?\s*;/g)) {
    referencedCss.add(m[1]);
  }
}

const stale = [];
for (const name of fs.readdirSync(publicDir)) {
  if (!/^site-system-v35\.30\.\d+\.css$/.test(name)) continue;
  if (name === "site-system-v35.30.17.css") continue;
  if (referencedCss.has(name)) {
    throw new Error(`Refusing to remove referenced stylesheet: public/${name}`);
  }
  stale.push(path.join(publicDir, name));
}

const generated = [
  path.join(root, "dist-check"),
];

const updateArchives = fs.readdirSync(root)
  .filter(name =>
    /^Vestige-V35\.30\.(12|13|14|15|16|17|18|19).*\.zip$/i.test(name) ||
    /^apply-v35\.30\.(12|13|14|15|16|17|18|19).*\.ps1$/i.test(name)
  )
  .map(name => path.join(root, name));

const targets = [...stale, ...generated, ...updateArchives];

if (checkOnly) {
  const present = targets.filter(exists);
  if (present.length) {
    console.error("Workspace hygiene check FAILED. Removable generated/stale items remain:");
    present.forEach(p => console.error(` - ${rel(p)}`));
    process.exit(1);
  }
  console.log("Workspace hygiene check PASS.");
  console.log("Canonical shared stylesheet: public/site-system-v35.30.17.css");
  process.exit(0);
}

const removed = [];
for (const target of targets) {
  if (remove(target)) removed.push(rel(target));
}

console.log("Vestige workspace cleanup complete.");
if (removed.length) {
  console.log("Removed:");
  removed.forEach(p => console.log(` - ${p}`));
} else {
  console.log("No generated or stale items required removal.");
}
console.log("Preserved: source, assets, node_modules, recovery material, and all non-update ZIP archives.");