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

export async function readHandle(page: Page): Promise<SupabaseHandle> {
  // La función serializada por Playwright NO pasa por Vite. Resolver la
  // configuración en Node y leer exclusivamente la sesión de ese proyecto.
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) throw new Error("supabaseRest: faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY en el runner.");
  const destination = new URL(url);
  if (!/^https?:$/.test(destination.protocol) || destination.username || destination.password) {
    throw new Error("supabaseRest: URL de Supabase inválida.");
  }
  const storageKey = `sb-${destination.hostname.split(".")[0]}-auth-token`;
  const accessToken = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    let parsed: { access_token?: string } | null = null;
    try {
      parsed = JSON.parse(raw) as { access_token?: string };
    } catch {
      return null;
    }
    if (!parsed?.access_token) return null;
    return parsed.access_token;
  }, storageKey);
  if (!accessToken) {
    throw new Error(
      "supabaseRest: no hay sesión en el page (sb-*-auth-token ausente o sin access_token). " +
        "¿Olvidaste llamar a loginAs(page) antes del cleanup?",
    );
  }
  return { url: destination.origin, anonKey, accessToken };
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
      return res.status === 204 ? null : await res.json() as unknown;
    },
  };
}
