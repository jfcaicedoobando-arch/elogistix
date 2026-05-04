#!/usr/bin/env node
/**
 * Genera public/changelog.json con todas las entradas (recent + v8 + legacy)
 * deduplicadas por version. Pensado para consumo externo: RSS, webhooks Slack,
 * release notes embebibles, etc.
 *
 * Se ejecuta automáticamente en `npm run build` vía prebuild.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  const root = resolve(process.cwd());
  // Importes dinámicos para evitar arrastrar TS resolution: usamos tsx loader.
  const dataUrl = pathToFileURL(resolve(root, "src/content/changelogData.ts")).href;
  const v8Url = pathToFileURL(resolve(root, "src/content/changelog/v8.ts")).href;
  const legacyUrl = pathToFileURL(resolve(root, "src/content/changelog/legacy.ts")).href;

  const data = await import(dataUrl);
  const v8 = await import(v8Url);
  const legacy = await import(legacyUrl);

  const merged = data.dedupeByVersion([
    ...data.recentChangelog,
    ...v8.changelogV8,
    ...legacy.legacyChangelog,
  ]);

  const out = {
    generatedAt: new Date().toISOString(),
    count: merged.length,
    entries: merged,
  };

  const outDir = resolve(root, "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "changelog.json"), JSON.stringify(out, null, 2));
  console.log(`✅ public/changelog.json generado (${merged.length} entradas)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
