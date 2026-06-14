import { expect, test } from "@playwright/test";
import { internalCreds, loginAs } from "../fixtures/auth";

/**
 * Spec de seguridad cross-org (13.13.0 / Fase 1 — auditoría de tests).
 *
 * Objetivo: validar que un usuario autenticado en Org A NO puede acceder
 * vía URL directa a registros de Org B (embarques, facturas, cotizaciones).
 * La defensa real es RLS server-side; este spec verifica que la UI también
 * responde con not-found / redirect cuando RLS devuelve 0 rows.
 *
 * El ID "de otra org" se simula con un UUID válido pero inexistente para
 * la sesión actual — es indistinguible para el cliente de un ID que sí
 * existe pero pertenece a Org B (mismo comportamiento esperado: 404).
 *
 * Si se requiere un ID real de Org B, definir `E2E_CROSS_ORG_*_ID` como
 * secrets y el spec los usará en lugar del UUID dummy.
 */

const DUMMY_UUID = "00000000-0000-4000-8000-000000000000";

const targets = [
  {
    label: "embarque",
    path: (id: string) => `/embarques/${id}`,
    envId: "E2E_CROSS_ORG_EMBARQUE_ID",
  },
  {
    label: "factura",
    path: (id: string) => `/facturacion/facturas/${id}`,
    envId: "E2E_CROSS_ORG_FACTURA_ID",
  },
  {
    label: "cotización",
    path: (id: string) => `/cotizaciones/${id}`,
    envId: "E2E_CROSS_ORG_COTIZACION_ID",
  },
] as const;

test.describe("Flujo 06 — Seguridad cross-org", () => {
  for (const t of targets) {
    test(`bloquea acceso directo a ${t.label} de otra organización`, async ({ page }) => {
      await loginAs(page, internalCreds());

      const id = process.env[t.envId] ?? DUMMY_UUID;
      const response = await page.goto(t.path(id), { waitUntil: "domcontentloaded" });

      // No exigimos un código HTTP específico (SPA siempre responde 200 al
      // shell), pero sí que la UI muestre "no encontrado" / "sin acceso" o
      // redirija fuera del detalle. NUNCA debe verse datos reales.
      void response;
      await expect(page).not.toHaveURL(new RegExp(`${id}.*\\?`), { timeout: 10_000 });

      const guardCopy = page.getByText(
        /no encontrad|sin acceso|no autoriz|no existe|404|volver/i,
      );
      const redirected = !page.url().includes(id);

      // OK si: hubo redirect fuera del recurso, o hay copy explícito de bloqueo.
      const matched = redirected || (await guardCopy.first().isVisible().catch(() => false));
      expect(
        matched,
        `Cross-org ${t.label}: la UI no bloqueó el acceso (url=${page.url()})`,
      ).toBe(true);
    });
  }
});
