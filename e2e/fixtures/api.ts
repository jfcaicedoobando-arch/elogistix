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
    throw new Error("no se pudo obtener handle Supabase desde el page");
  }
  return handle;
}

export function supabaseRest(page: Page) {
  return {
    async patch(table: string, match: Record<string, string>, payload: Record<string, unknown>) {
      const h = await readHandle(page);
      const qs = Object.entries(match)
        .map(([k, v]) => `${encodeURIComponent(k)}=eq.${encodeURIComponent(v)}`)
        .join("&");
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
      const qs = Object.entries(match)
        .map(([k, v]) => `${encodeURIComponent(k)}=eq.${encodeURIComponent(v)}`)
        .join("&");
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
