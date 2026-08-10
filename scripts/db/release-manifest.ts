#!/usr/bin/env bun
/**
 * Mantiene el manifest de migraciones para APP_VERSION.
 *
 * Uso:
 *   bun run db:release-manifest:update           # genera/actualiza
 *   bun run db:release-manifest:check            # verifica
 */
import fs from "node:fs";
import path from "node:path";

const APP_VERSION_FILE = path.resolve("src/constants/appVersion.ts");
const MIGRATIONS_DIR = path.resolve("supabase/migrations");
const MANIFEST_PATH = path.resolve("supabase/releases/migration-manifest.json");

type Manifest = Record<string, { migrations: string[] }>;

function readAppVersion(): string {
  const content = fs.readFileSync(APP_VERSION_FILE, "utf-8");
  const match = /APP_VERSION\s*=\s*"([^"]+)"/.exec(content);
  if (!match) {
    throw new Error(`No se pudo leer APP_VERSION de ${APP_VERSION_FILE}`);
  }
  return match[1];
}

function listMigrations(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Directorio de migraciones no encontrado: ${MIGRATIONS_DIR}`);
  }
  const entries = fs.readdirSync(MIGRATIONS_DIR);
  return entries
    .filter((entry) => entry.endsWith(".sql") && !entry.startsWith("."))
    .sort();
}

function readManifest(): Manifest {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return {};
  }
  const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
  return JSON.parse(raw) as Manifest;
}

function writeManifest(manifest: Manifest): void {
  const dir = path.dirname(MANIFEST_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
}

function runCheck(version: string, migrations: string[], manifest: Manifest): void {
  const entry = manifest[version];
  if (!entry) {
    console.error(`ERROR: No existe manifest para APP_VERSION ${version}.`);
    console.error(`Ejecuta: bun run db:release-manifest:update`);
    process.exit(1);
  }

  const expected = JSON.stringify(migrations);
  const actual = JSON.stringify(entry.migrations);
  if (expected === actual) {
    console.log(`OK: manifest coincide con ${version} (${migrations.length} migraciones).`);
    return;
  }

  console.error(`ERROR: El set de migraciones no coincide con APP_VERSION ${version}.`);
  const added = migrations.filter((m) => !entry.migrations.includes(m));
  const removed = entry.migrations.filter((m) => !migrations.includes(m));
  if (added.length > 0) {
    console.error(`  Agregadas: ${added.join(", ")}`);
  }
  if (removed.length > 0) {
    console.error(`  Eliminadas: ${removed.join(", ")}`);
  }
  console.error(`Ejecuta: bun run db:release-manifest:update`);
  process.exit(1);
}

function runUpdate(version: string, migrations: string[], manifest: Manifest): void {
  const hadEntry = version in manifest;
  manifest[version] = { migrations };
  writeManifest(manifest);
  const action = hadEntry ? "actualizado" : "creado";
  console.log(`Manifest ${action} para ${version} (${migrations.length} migraciones).`);
  console.log(`Archivo: ${MANIFEST_PATH}`);
}

function printUsage(): void {
  console.log("Uso: release-manifest.ts [--check]");
  console.log("  Sin flags: genera/actualiza el manifest para APP_VERSION.");
  console.log("  --check: verifica que el manifest coincida con las migraciones actuales.");
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  const version = readAppVersion();
  const migrations = listMigrations();
  const manifest = readManifest();

  if (args.includes("--check")) {
    runCheck(version, migrations, manifest);
  } else {
    runUpdate(version, migrations, manifest);
  }
}

main();
