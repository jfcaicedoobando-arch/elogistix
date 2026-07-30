/**
 * Cliente REST autenticado contra Supabase para cleanups server-side.
 *
 * Lee el access token del localStorage del `page` (sb-<ref>-auth-token) y
 * hace fetch directo al REST de Supabase con los headers correctos.
 *
 * Uso típico (dentro de un afterEach):
 *
 *   await bestEffortCleanup("borrar factura E2E", async () => {
 *     await supabaseRest(page).delete("proveedor_facturas", { id: facturaId });
 *   });
 */
import type { Page } from "@playwright/test";

interface SupabaseHandle {
  url: string;
  anonKey: string;
  accessToken: string;
}

async function readHandle(page: Page): Promise<SupabaseHandle> {
  const handle = await page.evaluate(() => {
    // Tomamos url + anon key del cliente generado (window.__SUPA_E2E__ no
    // existe en prod; usamos los valores expuestos por Vite import.meta).
    // La forma robusta: buscar la sb-*-auth-token en localStorage.
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
    // VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY están inyectados en bundle.
    const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
    return {
      url: env.VITE_SUPABASE_URL ?? "",
      anonKey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
      accessToken: parsed.access_token,
    };
  });
  if (!handle || !handle.url || !handle.anonKey || !handle.accessToken) {
    throw new Error(
      "supabaseRest: no hay sesión en el page (sb-*-auth-token ausente o sin access_token). " +
        "¿Olvidaste llamar a loginAs(page) antes del cleanup?",
    );
  }
  return handle;
}

// Operadores PostgREST conocidos — si el valor empieza con uno de estos
// seguidos de `.`, se pasa tal cual; cualquier otro valor se serializa como `eq.<v>`.
const PGRST_OPS = /^(eq|neq|gt|gte|lt|lte|like|ilike|in|is|cs|cd|sl|sr|nxr|nxl|adj|ov|fts|plfts|phfts|wfts)\./;

function buildQs(match: Record<string, string>): string {
  return Object.entries(match)
    .map(([k, v]) => {
      const value = PGRST_OPS.test(v) ? v : `eq.${v}`;
      return `${encodeURIComponent(k)}=${encodeURIComponent(value)}`;
    })
    .join("&");
}

export function supabaseRest(page: Page) {
  return {
    async select(table: string, match: Record<string, string>, columns = "*") {
      const h = await readHandle(page);
      const qs = buildQs(match);
      const res = await fetch(
        `${h.url}/rest/v1/${table}?select=${encodeURIComponent(columns)}&${qs}`,
        {
          method: "GET",
          headers: {
            apikey: h.anonKey,
            Authorization: `Bearer ${h.accessToken}`,
          },
        },
      );
      if (!res.ok) throw new Error(`SELECT ${table} ${res.status}: ${await res.text()}`);
      return (await res.json()) as Array<Record<string, unknown>>;
    },

    async patch(table: string, match: Record<string, string>, payload: Record<string, unknown>) {
      const h = await readHandle(page);
      const qs = buildQs(match);
      const res = await fetch(`${h.url}/rest/v1/${table}?${qs}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: h.anonKey,
          Authorization: `Bearer ${h.accessToken}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`PATCH ${table} ${res.status}: ${await res.text()}`);
    },
    async delete(table: string, match: Record<string, string>) {
      const h = await readHandle(page);
      const qs = buildQs(match);
      const res = await fetch(`${h.url}/rest/v1/${table}?${qs}`, {
        method: "DELETE",
        headers: {
          apikey: h.anonKey,
          Authorization: `Bearer ${h.accessToken}`,
        },
      });
      if (!res.ok) throw new Error(`DELETE ${table} ${res.status}: ${await res.text()}`);
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      const h = await readHandle(page);
      const res = await fetch(`${h.url}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: h.anonKey,
          Authorization: `Bearer ${h.accessToken}`,
        },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`RPC ${fn} ${res.status}: ${await res.text()}`);
    },
  };
}
