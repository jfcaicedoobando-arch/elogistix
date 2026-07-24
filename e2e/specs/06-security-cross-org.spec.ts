import { expect, test, type Response } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";
import { requireFixture } from "../fixtures/requireFixture";

/**
 * Spec de seguridad cross-org.
 *
 * Valida que un usuario autenticado en Org A NO acceda vía URL directa a
 * registros de Org B. La defensa real es RLS server-side; este spec verifica:
 *   1. La UI muestra not-found / sin acceso, o redirige fuera del recurso.
 *   2. Ninguna respuesta de `/rest/v1/<tabla>?id=eq.<id>` devuelve filas.
 *
 * Para validación REAL de cross-org se requieren IDs de Org B en env:
 *   E2E_CROSS_ORG_EMBARQUE_ID, E2E_CROSS_ORG_FACTURA_ID, E2E_CROSS_ORG_COTIZACION_ID
 *
 * Sin ellos se usa un UUID dummy (sólo valida 404, no aísla orgs). El spec
 * imprime un warning en ese caso.
 */

const DUMMY_UUID = "00000000-0000-4000-8000-000000000000";

const targets = [
  {
    label: "embarque",
    path: (id: string) => `/embarques/${id}`,
    envId: "E2E_CROSS_ORG_EMBARQUE_ID",
    restTable: "embarques",
  },
  {
    label: "factura",
    path: (id: string) => `/facturacion/${id}`,
    envId: "E2E_CROSS_ORG_FACTURA_ID",
    restTable: "facturas",
  },
  {
    label: "cotización",
    path: (id: string) => `/cotizaciones/${id}`,
    envId: "E2E_CROSS_ORG_COTIZACION_ID",
    restTable: "cotizaciones",
  },
] as const;

test.describe("Flujo 06 — Seguridad cross-org", () => {
  for (const t of targets) {
    test(`bloquea acceso directo a ${t.label} de otra organización`, async ({ page }) => {
      // Auditoría E2E (Ola 3, v13.312.17): antes se degradaba a UUID dummy con
      // `console.warn` silencioso — el test quedaba verde sin validar aislamiento
      // real. Ahora si falta el ID cross-org, `requireFixture` skippea (o falla
      // duro cuando E2E_STRICT_FIXTURES=1).
      const realId = process.env[t.envId];
      requireFixture(
        Boolean(realId),
        `${t.envId} no definido — se requiere un ID real de OTRA organización para validar aislamiento cross-org`,
      );
      const id = realId!;

      await loginAs(page, internalCreds());

      // Capturar respuestas REST que pidan el recurso específico.
      const leakedRows: string[] = [];
      const onResp = async (resp: Response) => {
        const url = resp.url();
        if (!url.includes(`/rest/v1/${t.restTable}`)) return;
        if (!url.includes(`id=eq.${id}`)) return;
        try {
          const body = await resp.json();
          if (Array.isArray(body) && body.length > 0) leakedRows.push(url);
        } catch {
          // body no-JSON: ignorar
        }
      };
      page.on("response", onResp);

      // Esperar a que se dispare al menos la query REST del recurso (o el
      // load del documento si la guardia bloquea antes de pedir datos), en
      // vez de un timeout fijo. Esto reduce flakes y acorta el spec.
      const restPromise = page
        .waitForResponse(
          (r) => r.url().includes(`/rest/v1/${t.restTable}`) && r.url().includes(`id=eq.${id}`),
          { timeout: 8_000 },
        )
        .catch(() => null);
      await page.goto(t.path(id), { waitUntil: "domcontentloaded" });
      await restPromise;
      // Pequeño margen para que la UI reaccione (404 / redirect) tras la respuesta.
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      page.off("response", onResp);

      // Assert #1: REST nunca debe haber devuelto el registro.
      expect(
        leakedRows,
        `Fuga de datos cross-org: REST devolvió filas para ${t.label} ${id}`,
      ).toHaveLength(0);

      // Assert #2: la UI debe haber bloqueado el acceso (guard copy o redirect).
      const guardCopy = page.getByText(
        /no encontrad|sin acceso|no autoriz|no existe|404|volver/i,
      );
      const redirected = !page.url().includes(id);
      const hasGuardCopy = await guardCopy.first().isVisible().catch(() => false);

      expect(
        redirected || hasGuardCopy,
        `Cross-org ${t.label}: la UI no bloqueó el acceso (url=${page.url()})`,
      ).toBe(true);
    });
  }
});
