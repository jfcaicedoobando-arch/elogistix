#!/usr/bin/env bun
/**
 * scripts/audit-no-env.ts — R5TC-02 (Ola 14).
 *
 * Higiene de variables de entorno en el workspace de release.
 *
 * ADAPTACIÓN vs. el sprint original: en este proyecto el `.env` de la raíz lo
 * genera y mantiene la plataforma (Lovable Cloud) y es OBLIGATORIO para el
 * build de Vite (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
 * `VITE_SUPABASE_PROJECT_ID`). Borrarlo o vaciarlo rompe la app publicada, así
 * que el guardrail NO falla por su existencia: falla por lo que NO debe estar
 * dentro de ningún `.env` (secretos server-side) y por archivos `.env.*`
 * "sombra" que nadie declaró.
 *
 * Reglas:
 *   1) Sólo se permiten en la raíz: `.env` (gestionado por la plataforma) y los
 *      ejemplos declarados en `PERMITIDOS`.
 *   2) Ningún `.env*` puede contener secretos server-side: `service_role`,
 *      `SUPABASE_DB_PASSWORD`, `SENTRY_AUTH_TOKEN`, `FACTURAPI_*_KEY`, etc.
 *
 * Uso: `bun run audit:no-env` (incluido en `audit:all` y en el job de
 * guardrails de CI).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Archivos `.env*` aceptados en la raíz del repo. */
export const PERMITIDOS = new Set([".env", ".env.example", ".env.e2e.example"]);

/** Claves cuya presencia (con valor) en un `.env` es un incidente. */
const CLAVES_PROHIBIDAS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_DB_URL",
  "SENTRY_AUTH_TOKEN",
  "FACTURAPI_SECRET_KEY",
  "FACTURAPI_LIVE_KEY",
  "LOVABLE_API_KEY",
  "OPENAI_API_KEY",
];

const JWT_RE = /eyJ[A-Za-z0-9_-]{5,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;

function decodificarPayload(b64: string): Record<string, unknown> | null {
  try {
    const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Analiza el contenido de un `.env` y devuelve las violaciones encontradas.
 * Función pura para poder probarla sin tocar el filesystem.
 */
export function analizarEnv(nombre: string, contenido: string): string[] {
  const violaciones: string[] = [];

  for (const linea of contenido.split("\n")) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const [clave, ...resto] = limpia.split("=");
    const valor = resto.join("=").trim();
    if (!valor) continue;
    if (CLAVES_PROHIBIDAS.includes(clave.trim())) {
      violaciones.push(`${nombre}: contiene el secreto server-side ${clave.trim()}`);
    }
  }

  // Cualquier JWT con rol distinto de anon/publishable es un secreto.
  for (const [, payload] of contenido.matchAll(JWT_RE)) {
    const claims = decodificarPayload(payload);
    const role = typeof claims?.role === "string" ? claims.role : null;
    if (role && role !== "anon") {
      violaciones.push(`${nombre}: contiene un JWT con rol "${role}" (sólo se permite anon)`);
    }
  }

  return violaciones;
}

/** Recorre la raíz y devuelve todas las violaciones (archivos + contenido). */
export function auditarRaiz(root: string, entradas: string[]): string[] {
  const violaciones: string[] = [];
  for (const entrada of entradas) {
    if (!entrada.startsWith(".env")) continue;
    if (!PERMITIDOS.has(entrada)) {
      violaciones.push(
        `archivo .env no declarado en la raíz: ${entrada} (permitidos: ${[...PERMITIDOS].join(", ")})`,
      );
      continue;
    }
    let contenido = "";
    try {
      contenido = readFileSync(join(root, entrada), "utf8");
    } catch {
      continue;
    }
    violaciones.push(...analizarEnv(entrada, contenido));
  }
  return violaciones;
}

function main(): void {
  const root = process.cwd();
  const violaciones = auditarRaiz(root, readdirSync(root));

  if (violaciones.length === 0) {
    console.log("✓ Higiene .env: 0 violaciones");
    return;
  }
  console.error(`\n✗ Higiene .env: ${violaciones.length} violación(es)\n`);
  for (const v of violaciones) console.error(`    ${v}`);
  console.error(
    "\nCómo arreglar:\n" +
      "  • Los secretos server-side NO viven en `.env`: se registran como secrets del backend.\n" +
      "  • `.env` de la raíz sólo debe traer valores publishable (VITE_*) que inyecta la plataforma.\n" +
      "  • Si un secreto quedó expuesto, rótalo antes de cerrar el release.\n" +
      "  • Borra los `.env.*` sombra o decláralos en PERMITIDOS de scripts/audit-no-env.ts.\n",
  );
  process.exit(1);
}

if (import.meta.main) main();
