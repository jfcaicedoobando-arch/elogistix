/**
 * Spec 26 — Aislamiento multi-tenant end-to-end.
 *
 * Provisiona (fuera del spec, ver `bun run e2e:provision-multi-tenant`) dos
 * organizaciones dedicadas con un admin cada una y datos trazadores. Aquí se
 * loguea con las credenciales de cada org y valida que:
 *
 *   1. Rutas directas a IDs de la otra org → not-found / redirect.
 *   2. Respuestas REST a `/rest/v1/<tabla>?id=eq.<otherOrgId>` devuelven `[]`.
 *   3. Búsqueda global (Ctrl+K) no expone el marker de la otra org.
 *   4. Catálogos sembrados (`factura_series`, `crm_etapas_pipeline`,
 *      `crm_motivos_perdida`, `presupuesto_categorias`) no cruzan `org_id`.
 *   5. Storage: el objeto marker de la otra org no descarga.
 *
 * Si no existe `e2e/.tmp/multi-tenant.json` el spec se skipea con warning.
 */
import { expect, test, type Page } from "@playwright/test";
import { loginAs, switchUser } from "../fixtures/auth";
import { loadMultiTenantFixture, multiTenantFixturePath, type OrgFixture } from "../fixtures/multiTenant";

const fixture = loadMultiTenantFixture();

test.describe("Flujo 26 — Aislamiento multi-tenant", () => {
  test.beforeAll(() => {
    if (!fixture) {
      console.warn(
        `[26-multi-tenant] Fixture no encontrado en ${multiTenantFixturePath()}. ` +
          `Corre 'bun run e2e:provision-multi-tenant' antes. Skipping.`,
      );
    }
  });

  test.skip(!fixture, "Falta e2e/.tmp/multi-tenant.json — corre e2e:provision-multi-tenant");

  test("Org A NO ve datos de Org B", async ({ page }) => {
    if (!fixture) return;
    await loginAs(page, fixture.creds.a);
    await assertNoCrossAccess(page, fixture.org_a, fixture.org_b);
  });

  test("Org B NO ve datos de Org A", async ({ page }) => {
    if (!fixture) return;
    await loginAs(page, fixture.creds.b);
    await assertNoCrossAccess(page, fixture.org_b, fixture.org_a);
  });

  test("Catálogos sembrados por `handle_new_organization` no cruzan orgs", async ({ page }) => {
    if (!fixture) return;
    await loginAs(page, fixture.creds.a);
    await assertCatalogosAislados(page, fixture.org_a, fixture.org_b);

    await switchUser(page, fixture.creds.b);
    await assertCatalogosAislados(page, fixture.org_b, fixture.org_a);
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────

interface CrossTarget {
  label: string;
  path: (id: string) => string;
  restTable: string;
  otherId: (o: OrgFixture) => string;
}
const TARGETS: CrossTarget[] = [
  { label: "embarque", path: (id) => `/embarques/${id}`, restTable: "embarques", otherId: (o) => o.embarque_id },
  { label: "factura", path: (id) => `/facturacion/${id}`, restTable: "facturas", otherId: (o) => o.factura_id },
  { label: "cliente", path: (id) => `/clientes/${id}`, restTable: "clientes", otherId: (o) => o.cliente_id },
  { label: "cotización", path: (id) => `/cotizaciones/${id}`, restTable: "cotizaciones", otherId: (o) => o.cotizacion_id },
];

async function assertNoCrossAccess(page: Page, _own: OrgFixture, other: OrgFixture) {
  for (const t of TARGETS) {
    const id = t.otherId(other);
    const leaked: string[] = [];
    const onResp = async (resp: { url: () => string; json: () => Promise<unknown> }) => {
      const url = resp.url();
      if (!url.includes(`/rest/v1/${t.restTable}`) || !url.includes(`id=eq.${id}`)) return;
      try {
        const body = (await resp.json()) as unknown;
        if (Array.isArray(body) && body.length > 0) leaked.push(url);
      } catch {
        /* body no-JSON */
      }
    };
    page.on("response", onResp);
    await page.goto(t.path(id), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    page.off("response", onResp);

    expect(leaked, `Fuga cross-org detectada en ${t.label}: ${leaked.join(", ")}`).toEqual([]);
    // La UI debe indicar sin acceso: no encontrarse el marker en la página.
    await expect(page.getByText(other.marker)).toHaveCount(0);
  }

  // Ctrl+K global search no debe listar el marker de la otra org.
  await page.goto("/");
  await page.keyboard.press("Control+K").catch(() => undefined);
  const cmd = page.getByRole("dialog").getByRole("textbox").first();
  if (await cmd.isVisible().catch(() => false)) {
    await cmd.fill(other.marker);
    await page.waitForTimeout(600);
    await expect(page.getByRole("dialog").getByText(other.marker)).toHaveCount(0);
    await page.keyboard.press("Escape");
  }

  // Storage: descargar el marker de la otra org vía signed URL debe fallar.
  const signResp = await page.request.post(
    `${supabaseRestUrl(page)}/storage/v1/object/sign/${other.storage_bucket}/${other.storage_path}`,
    { data: { expiresIn: 60 }, headers: authHeadersFromPage(page) },
  );
  // 403 (RLS) o 400/404 (no encontrado) — cualquier cosa MENOS 200.
  expect(signResp.status(), `Storage cross-org leak en ${other.storage_path}`).not.toBe(200);
}

async function assertCatalogosAislados(page: Page, own: OrgFixture, other: OrgFixture) {
  const tablas = ["factura_series", "crm_etapas_pipeline", "crm_motivos_perdida", "presupuesto_categorias"];
  for (const tabla of tablas) {
    const url = `${supabaseRestUrl(page)}/rest/v1/${tabla}?select=organization_id&limit=200`;
    const resp = await page.request.get(url, { headers: authHeadersFromPage(page) });
    expect(resp.ok(), `${tabla} REST no OK`).toBe(true);
    const rows = (await resp.json()) as Array<{ organization_id: string }>;
    const orgIds = new Set(rows.map((r) => r.organization_id));
    // La org propia debe estar sembrada (verifica que el trigger corrió).
    expect(orgIds.has(own.organization_id), `${tabla} sin siembra para ${own.organization_id}`).toBe(true);
    // La org ajena NO debe aparecer.
    expect(orgIds.has(other.organization_id), `${tabla} filtró org ajena`).toBe(false);
  }
}

// ── Utilidades REST ─────────────────────────────────────────────────────

function supabaseRestUrl(page: Page): string {
  const url = process.env.E2E_BASE_URL ?? page.url();
  // El client Supabase usa `VITE_SUPABASE_URL`. En specs no lo tenemos, así
  // que lo derivamos de la primera respuesta REST que capturemos, o del env.
  const supa = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (supa) return supa.replace(/\/$/, "");
  // Fallback: heurístico basado en storage. Este spec depende de que la env
  // esté propagada al proceso Playwright.
  throw new Error(
    `VITE_SUPABASE_URL no está definido en el entorno del test (base ${url}).`,
  );
}

function authHeadersFromPage(page: Page): Record<string, string> {
  const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  const headers: Record<string, string> = { apikey: anon };
  // Extraer el access_token del storage state de la página.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = (page as any).__lastAuthToken as string | undefined;
  if (state) headers.Authorization = `Bearer ${state}`;
  return headers;
}
