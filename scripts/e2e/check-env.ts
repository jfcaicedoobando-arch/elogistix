/**
 * scripts/e2e/check-env.ts — valida que las variables mínimas para correr
 * Playwright E2E estén configuradas y reporta qué specs se saltarán.
 *
 * Uso: `bun run e2e:check`
 *
 * Sale con exit code 1 si faltan MÍNIMOS obligatorios (E2E_BASE_URL, E2E_EMAIL,
 * E2E_PASSWORD). Los grupos opcionales sólo se reportan como warnings.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

const envFile = resolve(process.cwd(), ".env.e2e");
if (existsSync(envFile)) {
  loadDotenv({ path: envFile });
  console.log(`✔ .env.e2e cargado desde ${envFile}`);
} else {
  console.log(`ℹ .env.e2e no existe — leyendo variables del shell.`);
  console.log(`  Sugerencia: cp .env.e2e.example .env.e2e && edítalo.`);
}

const has = (name: string) => Boolean(process.env[name] && process.env[name] !== "");

const REQUIRED = ["E2E_BASE_URL", "E2E_EMAIL", "E2E_PASSWORD"] as const;

type Group = {
  label: string;
  vars: readonly string[];
  enables: string;
};

const OPTIONAL_GROUPS: readonly Group[] = [
  {
    label: "Portal cliente",
    vars: ["E2E_PORTAL_EMAIL", "E2E_PORTAL_PASSWORD"],
    enables: "specs 05, 18",
  },
  {
    label: "Cross-org",
    vars: [
      "E2E_CROSS_ORG_EMBARQUE_ID",
      "E2E_CROSS_ORG_FACTURA_ID",
      "E2E_CROSS_ORG_COTIZACION_ID",
    ],
    enables: "spec 06 (con datos reales, no dummy)",
  },
  { label: "Wizard teclado", vars: ["E2E_HAS_SEED"], enables: "spec 07" },
  {
    label: "Flujo fiscal (FacturApi)",
    vars: ["E2E_FISCAL", "E2E_PROFORMA_NUMERO"],
    enables: "specs 08, 25",
  },
  {
    label: "Cierre embarque",
    vars: ["E2E_EMBARQUE_CHECKLIST_INCOMPLETO_ID"],
    enables: "spec 09",
  },
  { label: "Auditoría bulk", vars: ["E2E_HAS_AUDIT_DATA"], enables: "spec 10" },
  {
    label: "Cotización → embarque",
    vars: ["E2E_COTIZACION_ACEPTADA_ID"],
    enables: "spec 11",
  },
  {
    label: "CXP mutadores",
    vars: ["E2E_PROVEEDOR_ID", "E2E_EMBARQUE_PARA_CXP_ID"],
    enables: "spec 12",
  },
  {
    label: "Multi-tenant",
    vars: [
      "E2E_MT_A_EMAIL",
      "E2E_MT_A_PASSWORD",
      "E2E_MT_B_EMAIL",
      "E2E_MT_B_PASSWORD",
    ],
    enables: "spec 26",
  },
  {
    label: "Provisioning de usuarios",
    vars: ["E2E_PROVISION_SECRET", "VITE_SUPABASE_URL"],
    enables: "bun run e2e:provision(-multi-tenant)",
  },
];

let hardFail = false;

console.log("\n=== Mínimos obligatorios ===");
for (const name of REQUIRED) {
  const ok = has(name);
  console.log(`  ${ok ? "✔" : "✘"} ${name}${ok ? "" : "   (falta)"}`);
  if (!ok) hardFail = true;
}

console.log("\n=== Grupos opcionales ===");
for (const g of OPTIONAL_GROUPS) {
  const missing = g.vars.filter((v) => !has(v));
  if (missing.length === 0) {
    console.log(`  ✔ ${g.label} — habilita ${g.enables}`);
  } else if (missing.length === g.vars.length) {
    console.log(`  · ${g.label} — SKIP (${g.enables}). Sin: ${missing.join(", ")}`);
  } else {
    console.log(
      `  ⚠ ${g.label} — parcial. Falta: ${missing.join(", ")} (habilita ${g.enables})`,
    );
  }
}

if (hardFail) {
  console.error(
    "\n✘ Faltan variables MÍNIMAS. Copia .env.e2e.example → .env.e2e y rellénalas.",
  );
  process.exit(1);
}

const baseUrl = process.env.E2E_BASE_URL!;
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(baseUrl);
console.log(
  `\n✔ Configuración mínima OK. Modo: ${isLocal ? "LOCAL (arrancará vite dev)" : "REMOTO (staging)"}.`,
);
console.log("  Siguiente paso: `bun run e2e:install` (una vez) y `bun run e2e`.");
