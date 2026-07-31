/**
 * Flujo 30 — Crear factura manual y timbrar (R4 P1-3).
 *
 * Hallazgo Ronda 4: al crear-y-timbrar se lanzaba `TypeError: ...slice`
 * (se leía `uuid_fiscal` de una respuesta del PAC sin validar) y el detalle
 * del borrador quedaba en "Cargando…" para siempre.
 *
 * Este spec cubre las tres garantías del fix:
 *   1. Respuesta del PAC sin UUID → toast con la causa real, nunca TypeError.
 *   2. El detalle del borrador renderiza (o muestra error con reintento),
 *      nunca un skeleton infinito.
 *   3. Ningún error de consola tipo "reading 'slice'".
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";

/** Errores que delatan el bug original (acceso a propiedad de undefined). */
const PATRON_TYPE_ERROR = /reading '(slice|uuid_fiscal|serie|folio)'/i;

test.describe("Flujo 30 — Factura manual: crear y timbrar", () => {
  test("el PAC sin UUID muestra la causa real y no un TypeError", async ({ page }) => {
    const errores: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errores.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e) => errores.push(e.message.slice(0, 300)));

    // El PAC responde error de negocio (sin UUID) para todo intento de timbrado.
    await page.route("**/functions/v1/facturapi-timbrar**", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "El receptor no tiene régimen fiscal válido" }),
      }),
    );

    await loginAs(page, internalCreds());
    await page.goto("/facturacion");
    await expect(page.getByRole("heading", { name: /facturaci/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    // Abrir el detalle de la primera factura disponible e intentar timbrar.
    const primeraFila = page.locator("table tbody tr").first();
    if (!(await primeraFila.isVisible().catch(() => false))) {
      test.skip(true, "El entorno no tiene facturas para timbrar");
    }
    await primeraFila.click();

    const timbrar = page.getByRole("button", { name: /timbrar/i }).first();
    if (await timbrar.isVisible().catch(() => false)) {
      await timbrar.click();
      // Confirmación del diálogo de timbrado, si existe.
      const confirmar = page
        .getByRole("button", { name: /^(timbrar|confirmar|sí, timbrar)/i })
        .last();
      if (await confirmar.isVisible().catch(() => false)) await confirmar.click();

      // Debe aparecer un toast con la causa devuelta por el PAC.
      await expect(page.getByText(/régimen fiscal|no se pudo timbrar|error/i).first()).toBeVisible({
        timeout: 20_000,
      });
    }

    // El detalle nunca queda en skeleton infinito.
    await expect(page.getByText(/^cargando/i).first()).toBeHidden({ timeout: 20_000 });

    expect(
      errores.filter((e) => PATRON_TYPE_ERROR.test(e)),
      "no debe haber TypeError por leer campos de la respuesta del PAC",
    ).toEqual([]);
  });

  test("el detalle de un borrador renderiza contenido o error con reintento", async ({ page }) => {
    await loginAs(page, internalCreds());

    // Id inexistente: el detalle debe fallar con mensaje, no colgarse cargando.
    await page.goto("/facturacion/00000000-0000-0000-0000-000000000000");

    await expect(page.getByText(/^cargando/i).first()).toBeHidden({ timeout: 25_000 });
    await expect(
      page.getByText(/no se pudo cargar|no encontrada|no existe|sin resultados/i).first(),
    ).toBeVisible({ timeout: 25_000 });
  });
});
