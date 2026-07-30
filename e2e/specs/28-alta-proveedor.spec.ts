/**
 * Flujo 28 — Alta de proveedor (R-03).
 *
 * Cubre el hallazgo de la Ronda 3: el alta fallaba con "Error al crear
 * proveedor: undefined" porque el error real no se propagaba y el payload
 * mezclaba `tipo` con `origen_proveedor`.
 *
 * Verifica:
 *  1. Alta Nacional / Transportista.
 *  2. Alta Extranjero / Agente de Carga.
 *  3. Que ningún toast muestre la cadena "undefined".
 *
 * Limpieza best-effort por nombre con sufijo E2E.
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";
import { bestEffortCleanup } from "../fixtures/cleanup";
import { supabaseRest } from "../fixtures/api";

type Caso = {
  etiqueta: string;
  origen: "Nacional" | "Extranjero";
  tipo: RegExp;
};

const CASOS: Caso[] = [
  { etiqueta: "Nacional/Transportista", origen: "Nacional", tipo: /transportista/i },
  { etiqueta: "Extranjero/Agente", origen: "Extranjero", tipo: /agente/i },
];

test.describe("Flujo 28 — Alta de proveedor", () => {
  const creados: string[] = [];

  test.afterEach(async ({ page }, testInfo) => {
    for (const nombre of creados.splice(0)) {
      await bestEffortCleanup(testInfo, `borrar proveedor ${nombre}`, async () => {
        await supabaseRest(page).delete("proveedores", { nombre });
      });
    }
  });

  for (const caso of CASOS) {
    test(`crea proveedor ${caso.etiqueta} sin errores "undefined"`, async ({ page }) => {
      await loginAs(page, internalCreds());
      await page.goto("/compras/proveedores");

      const nombre = `E2E Proveedor R3 ${caso.origen} ${Date.now()}`;

      await page.getByRole("button", { name: /nuevo proveedor/i }).first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      // Origen (Nacional | Extranjero) — nunca debe ir al campo `tipo`.
      await dialog.getByRole("combobox").first().click();
      await page.getByRole("option", { name: caso.origen, exact: true }).click();

      // Tipo de proveedor (enum tipo_proveedor).
      const tipoTrigger = dialog.getByRole("combobox").nth(1);
      await tipoTrigger.click();
      await page.getByRole("option", { name: caso.tipo }).first().click();

      await dialog.getByLabel(/nombre/i).first().fill(nombre);

      await dialog.getByRole("button", { name: /guardar|crear|siguiente/i }).first().click();

      // El bug original producía este texto exacto en el toast.
      await expect(page.getByText(/undefined/i)).toHaveCount(0);

      // El proveedor debe existir en BD.
      const rows = await supabaseRest(page).select("proveedores", { nombre });
      expect(Array.isArray(rows) ? rows.length : 0).toBeGreaterThan(0);
      creados.push(nombre);
    });
  }
});
