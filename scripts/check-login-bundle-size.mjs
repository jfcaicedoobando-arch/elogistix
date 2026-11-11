import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

// Primera carga de /login tras separar layouts y Sentry: 76 archivos, 343 KiB.
const MAX_FILES = 82;
const MAX_BYTES = 365 * 1024;
const dist = process.argv[2] ?? "dist";
const manifest = JSON.parse(readFileSync(join(dist, ".vite", "manifest.json"), "utf8"));
const pending = ["index.html", "src/features/auth/routes/Login.tsx"];
const visited = new Set();
const files = new Set();

while (pending.length > 0) {
  const id = pending.pop();
  if (visited.has(id)) continue;
  visited.add(id);
  const chunk = manifest[id];
  if (!chunk) throw new Error(`Falta ${id} en el manifiesto de Vite`);
  if (chunk.file.endsWith(".js")) files.add(chunk.file);
  pending.push(...(chunk.imports ?? []));
}

let bytes = 0;
for (const file of files) {
  bytes += gzipSync(readFileSync(join(dist, file)), { level: 9 }).length;
}

console.log(`/login · ${files.size}/${MAX_FILES} archivos JS · ${(bytes / 1024).toFixed(1)}/${MAX_BYTES / 1024} KiB gzip`);
if (files.size > MAX_FILES || bytes > MAX_BYTES) {
  console.error("::error::El grafo inicial de JavaScript de /login excede el presupuesto acumulado.");
  process.exitCode = 1;
}
