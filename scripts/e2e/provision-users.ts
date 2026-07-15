#!/usr/bin/env tsx
/**
 * Provisiona (o actualiza) los usuarios que usa la suite E2E de Playwright:
 *
 *   - Admin interno    → user_roles = 'admin'   + organization_members
 *   - Cliente portal   → user_roles = 'cliente' + client_users
 *
 * Es idempotente: si el usuario ya existe, sólo resetea el password y reasigna
 * rol/membresía. Pensado para correrse:
 *
 *   - Local:  `bun run e2e:provision` antes del primer `bun run e2e`.
 *   - CI:     paso previo al matrix de Playwright (ver `.github/workflows/e2e.yml`).
 *
 * Variables requeridas (via `.env.e2e` o entorno):
 *
 *   VITE_SUPABASE_URL         (o SUPABASE_URL)  URL del proyecto Lovable Cloud
 *   E2E_PROVISION_SECRET      Secreto compartido con el edge function
 *   E2E_EMAIL, E2E_PASSWORD             Admin interno
 *   E2E_PORTAL_EMAIL, E2E_PORTAL_PASSWORD  Cliente portal (opcional)
 *
 * Variables opcionales:
 *
 *   E2E_ORG_ID           Organización objetivo (si se omite → primera org).
 *   E2E_CLIENTE_ID       Cliente a vincular al portal (si se omite → primer
 *                        cliente de la organización).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Cargar .env.e2e sin depender de dotenv (evita añadir devDep sólo para el script).
const envFile = resolve(process.cwd(), ".env.e2e");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
if (!supabaseUrl) {
  console.error("❌ Falta SUPABASE_URL o VITE_SUPABASE_URL");
  process.exit(1);
}
const provisionSecret = required("E2E_PROVISION_SECRET");
const anonKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  "";

const adminEmail = process.env.E2E_EMAIL;
const adminPassword = process.env.E2E_PASSWORD;
const portalEmail = process.env.E2E_PORTAL_EMAIL;
const portalPassword = process.env.E2E_PORTAL_PASSWORD;

if (!adminEmail && !portalEmail) {
  console.error("❌ Debes definir al menos E2E_EMAIL o E2E_PORTAL_EMAIL");
  process.exit(1);
}
if (adminEmail && !adminPassword) {
  console.error("❌ E2E_EMAIL definido pero falta E2E_PASSWORD");
  process.exit(1);
}
if (portalEmail && !portalPassword) {
  console.error("❌ E2E_PORTAL_EMAIL definido pero falta E2E_PORTAL_PASSWORD");
  process.exit(1);
}

const payload: Record<string, unknown> = {};
if (adminEmail) payload.admin = { email: adminEmail, password: adminPassword };
if (portalEmail) payload.portal = { email: portalEmail, password: portalPassword };
if (process.env.E2E_ORG_ID) payload.organization_id = process.env.E2E_ORG_ID;
if (process.env.E2E_CLIENTE_ID) payload.cliente_id = process.env.E2E_CLIENTE_ID;

const endpoint = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/e2e-provision-users`;

console.log(`→ POST ${endpoint}`);
console.log(`  admin:  ${adminEmail ?? "(omitido)"}`);
console.log(`  portal: ${portalEmail ?? "(omitido)"}`);

const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-e2e-secret": provisionSecret,
    ...(anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {}),
  },
  body: JSON.stringify(payload),
});

const text = await res.text();
let body: unknown;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

if (!res.ok) {
  console.error(`❌ Provisión falló (${res.status}):`, body);
  process.exit(1);
}

console.log("✅ Usuarios E2E listos:");
console.dir(body, { depth: 5 });
