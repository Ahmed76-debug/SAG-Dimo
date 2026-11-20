/* Regenerates server/demo-seed.json from the single source of truth in src/lib/seed.ts.
 * Usage: node scripts/generate-demo-seed.mjs
 * The server seeds an empty managed SQLite database with this snapshot on first run.
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = path.join(root, ".tmp");
fs.mkdirSync(tmpDir, { recursive: true });
const bundle = path.join(tmpDir, "seed-bundle.mjs");

await build({
  entryPoints: [path.join(root, "src/lib/seed.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  outfile: bundle,
  logLevel: "silent",
});

const mod = await import(`${pathToFileURL(bundle).href}?t=${Date.now()}`);
const db = mod.createSeed();

const out = path.join(root, "server", "demo-seed.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(db, null, 2), "utf8");

console.log(
  `[seed] wrote ${path.relative(root, out)} — patients=${db.patients.length}, ` +
    `appointments=${db.appointments.length}, visits=${db.visits.length}, ` +
    `prescriptions=${db.prescriptions.length}, invoices=${db.invoices.length}, ` +
    `bookings=${db.bookings.length}, archive=${db.archive.length}, users=${db.users.length}`
);
