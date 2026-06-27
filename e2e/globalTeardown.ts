/**
 * globalTeardown para Playwright.
 *
 * Cuenta filas huérfanas tagueadas `E2E_TEST` en las tablas que los specs
 * mutadores tocan, escribe un reporte consolidado JSON + Markdown en
 * `test-results/e2e-orphans-report.*` y FALLA el run de CI si el total
 * supera `E2E_ORPHAN_THRESHOLD` (default 0).
 *
 * Read-only contra la DB: no borra (eso es responsabilidad del cleanup
 * por spec).
 *
 * Requiere E2E_EMAIL/E2E_PASSWORD y E2E_BASE_URL para mintear sesión.
 */
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

const envFile = resolve(process.cwd(), ".env.e2e");
if (existsSync(envFile)) loadDotenv({ path: envFile });

interface OrphanProbe {
  table: string;
  column: string;
  filter: string; // PostgREST operator + value, p. ej. `like.*E2E_TEST*`
}

const PROBES: OrphanProbe[] = [
  { table: "embarques", column: "notas_internas", filter: "like.*E2E_TEST*" },
  { table: "proveedor_facturas", column: "referencia", filter: "like.*E2E_TEST*" },
  { table: "auditoria_revisiones", column: "comentario", filter: "like.*E2E_TEST*" },
  { table: "auditoria_comentarios", column: "comentario", filter: "like.*E2E_TEST*" },
  { table: "pagos_factura", column: "referencia", filter: "like.*E2E_TEST*" },
];

interface ProbeResult {
  table: string;
  column: string;
  count: number;
  error?: string;
}

const REPORT_DIR = resolve(process.cwd(), "test-results");
const REPORT_JSON = resolve(REPORT_DIR, "e2e-orphans-report.json");
const REPORT_MD = resolve(REPORT_DIR, "e2e-orphans-report.md");

function parseThreshold(): number {
  const raw = process.env.E2E_ORPHAN_THRESHOLD;
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function writeReport(
  results: ProbeResult[],
  threshold: number,
  total: number,
  runId: string,
): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  const payload = {
    runId,
    generatedAt: new Date().toISOString(),
    threshold,
    total,
    exceededThreshold: total > threshold,
    probes: results,
  };
  writeFileSync(REPORT_JSON, JSON.stringify(payload, null, 2), "utf8");

  const lines: string[] = [];
  lines.push(`# Reporte de huérfanos E2E`);
  lines.push("");
  lines.push(`- Run: \`${runId}\``);
  lines.push(`- Generado: ${payload.generatedAt}`);
  lines.push(`- Umbral: ${threshold}`);
  lines.push(`- Total huérfanos: **${total}**`);
  lines.push(`- Estado: ${payload.exceededThreshold ? "❌ EXCEDIDO" : "✅ OK"}`);
  lines.push("");
  lines.push(`| Tabla | Columna | Conteo | Error |`);
  lines.push(`| --- | --- | ---: | --- |`);
  for (const r of results) {
    lines.push(
      `| \`${r.table}\` | \`${r.column}\` | ${r.count} | ${r.error ? "`" + r.error + "`" : ""} |`,
    );
  }
  lines.push("");
  writeFileSync(REPORT_MD, lines.join("\n"), "utf8");
}

export default async function globalTeardown() {
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:8080";
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  const threshold = parseThreshold();
  const runId = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`;

  const emptyResults: ProbeResult[] = PROBES.map((p) => ({
    table: p.table,
    column: p.column,
    count: 0,
    error: "skipped: sin sesión",
  }));

  if (!email || !password) {
    writeReport(emptyResults, threshold, 0, runId);
    return;
  }

  const browser = await chromium.launch();
  const results: ProbeResult[] = [];
  try {
    const ctx = await browser.newContext({ storageState: "e2e/.auth/internal.json" });
    const page = await ctx.newPage();
    await page.goto(baseUrl).catch(() => undefined);
    const handle = await page
      .evaluate(() => {
        const keys = Object.keys(window.localStorage).filter((k) =>
          /^sb-[^-]+-auth-token$/.test(k),
        );
        if (keys.length === 0) return null;
        const raw = window.localStorage.getItem(keys[0]);
        if (!raw) return null;
        let parsed: { access_token?: string } | null = null;
        try {
          parsed = JSON.parse(raw) as { access_token?: string };
        } catch {
          return null;
        }
        if (!parsed?.access_token) return null;
        const env =
          (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
        return {
          url: env.VITE_SUPABASE_URL ?? "",
          anonKey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
          accessToken: parsed.access_token,
        };
      })
      .catch(() => null);

    if (!handle || !handle.url || !handle.anonKey || !handle.accessToken) {
      console.warn("[globalTeardown] sin sesión válida, salto el barrido de huérfanos.");
      writeReport(emptyResults, threshold, 0, runId);
      return;
    }

    for (const probe of PROBES) {
      results.push(await probeOrphans(handle, probe));
    }
  } finally {
    await browser.close();
  }

  const total = results.reduce((acc, r) => acc + r.count, 0);
  writeReport(results, threshold, total, runId);
  reportOutcome(results, total, threshold);
}

async function probeOrphans(
  handle: { url: string; anonKey: string; accessToken: string },
  probe: OrphanProbe,
): Promise<ProbeResult> {
  const qs = `${encodeURIComponent(probe.column)}=${encodeURIComponent(probe.filter)}&select=id`;
  try {
    const res = await fetch(`${handle.url}/rest/v1/${probe.table}?${qs}`, {
      headers: {
        apikey: handle.anonKey,
        Authorization: `Bearer ${handle.accessToken}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });
    if (!res.ok) {
      return { table: probe.table, column: probe.column, count: 0, error: `HTTP ${res.status}` };
    }
    const range = res.headers.get("content-range") ?? "0/0";
    const count = Number(range.split("/")[1] ?? 0);
    return { table: probe.table, column: probe.column, count };
  } catch (err) {
    return {
      table: probe.table,
      column: probe.column,
      count: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function reportOutcome(results: ProbeResult[], total: number, threshold: number): void {
  const dirty = results.filter((t) => t.count > 0);
  if (dirty.length === 0) {
    console.log(`[globalTeardown] ✓ sin huérfanos E2E_TEST. Reporte: ${REPORT_MD}`);
  } else {
    console.warn(
      `[globalTeardown] ⚠ huérfanos E2E_TEST detectados (total=${total}, umbral=${threshold}):\n` +
        dirty.map((t) => `  - ${t.table}.${t.column}: ${t.count}`).join("\n") +
        `\nReporte: ${REPORT_MD}`,
    );
  }
  if (total > threshold) {
    console.error(
      `[globalTeardown] ❌ Total de huérfanos (${total}) supera el umbral configurado (${threshold}). Falla CI.`,
    );
    process.exitCode = 1;
  }
}
