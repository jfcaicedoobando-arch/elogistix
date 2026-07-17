#!/usr/bin/env tsx
/**
 * Provisiona (o limpia) las dos organizaciones dedicadas a la prueba E2E de
 * aislamiento multi-tenant (`e2e/specs/26-multi-tenant-isolation.spec.ts`).
 *
 * Uso:
 *   bun run e2e:provision-multi-tenant          # provisiona
 *   bun run e2e:provision-multi-tenant -- --cleanup   # borra las dos orgs
 *
 * Requiere en `.env.e2e` (o en el entorno):
 *   VITE_SUPABASE_URL / SUPABASE_URL
 *   E2E_PROVISION_SECRET
 *   E2E_MT_A_EMAIL, E2E_MT_A_PASSWORD
 *   E2E_MT_B_EMAIL, E2E_MT_B_PASSWORD
 *
 * Opcionales:
 *   E2E_MT_A_NOMBRE (default "E2E Multi-Tenant A")
 *   E2E_MT_B_NOMBRE (default "E2E Multi-Tenant B")
 *
 * Escribe el resultado en `e2e/.tmp/multi-tenant.json` (git-ignored).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const envFile = resolve(process.cwd(), ".env.e2e");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ Falta variable de entorno: ${name}`);
    process.exit(1);
  }
  return v;
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
if (!supabaseUrl) {
  console.error("❌ Falta SUPABASE_URL o VITE_SUPABASE_URL");
  process.exit(1);
}
const provisionSecret = required("E2E_PROVISION_SECRET");
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

const nombreA = process.env.E2E_MT_A_NOMBRE ?? "E2E Multi-Tenant A";
const nombreB = process.env.E2E_MT_B_NOMBRE ?? "E2E Multi-Tenant B";
const emailA = required("E2E_MT_A_EMAIL");
const passA = required("E2E_MT_A_PASSWORD");
const emailB = required("E2E_MT_B_EMAIL");
const passB = required("E2E_MT_B_PASSWORD");

const cleanup = process.argv.includes("--cleanup");
const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/e2e-provision-multi-tenant${
  cleanup ? "?cleanup=1" : ""
}`;

const payload = {
  org_a: { nombre: nombreA, admin_email: emailA, admin_password: passA },
  org_b: { nombre: nombreB, admin_email: emailB, admin_password: passB },
};

async function main() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-e2e-secret": provisionSecret,
  };
  if (anonKey) headers.Authorization = `Bearer ${anonKey}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  const text = await res.text();
  if (!res.ok) {
    console.error(`❌ e2e-provision-multi-tenant → HTTP ${res.status}\n${text}`);
    process.exit(1);
  }
  const parsed = JSON.parse(text) as Record<string, unknown>;
  if (cleanup) {
    console.log("✅ Cleanup OK:", JSON.stringify(parsed, null, 2));
    return;
  }
  const outFile = resolve(process.cwd(), "e2e/.tmp/multi-tenant.json");
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ ...parsed, creds: { a: { email: emailA, password: passA }, b: { email: emailB, password: passB } } }, null, 2));
  console.log(`✅ Provisión multi-tenant OK → ${outFile}`);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
