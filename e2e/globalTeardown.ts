/**
 * globalTeardown para Playwright.
 *
 * Read-only: cuenta filas huérfanas tagueadas `E2E_TEST` en las tablas que
 * los specs mutadores tocan. NO borra (eso es responsabilidad del cleanup
 * por spec). Sólo loguea para visibilidad en CI.
 *
 * Requiere E2E_EMAIL/E2E_PASSWORD y E2E_BASE_URL para mintear sesión.
 */
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
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
];

export default async function globalTeardown() {
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:8080";
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) return; // sin creds, no podemos consultar

  const browser = await chromium.launch();
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
      // eslint-disable-next-line no-console
      console.warn("[globalTeardown] sin sesión válida, salto el barrido de huérfanos.");
      return;
    }

    const totals: Array<{ table: string; count: number }> = [];
    for (const probe of PROBES) {
      const qs = `${encodeURIComponent(probe.column)}=${encodeURIComponent(probe.filter)}&select=id`;
      const res = await fetch(`${handle.url}/rest/v1/${probe.table}?${qs}`, {
        headers: {
          apikey: handle.anonKey,
          Authorization: `Bearer ${handle.accessToken}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn(`[globalTeardown] ${probe.table}: ${res.status} ${await res.text()}`);
        continue;
      }
      const range = res.headers.get("content-range") ?? "0/0";
      const count = Number(range.split("/")[1] ?? 0);
      totals.push({ table: probe.table, count });
    }

    const dirty = totals.filter((t) => t.count > 0);
    if (dirty.length === 0) {
      // eslint-disable-next-line no-console
      console.log("[globalTeardown] ✓ sin huérfanos E2E_TEST.");
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        "[globalTeardown] ⚠ huérfanos E2E_TEST detectados:\n" +
          dirty.map((t) => `  - ${t.table}: ${t.count}`).join("\n"),
      );
    }
  } finally {
    await browser.close();
  }
}
