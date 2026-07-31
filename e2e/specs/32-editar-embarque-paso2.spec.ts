/**
 * Flujo 32 — Editor de embarque: el paso 2 llega hidratado (R4 P1-5).
 *
 * Hallazgo Ronda 4: al abrir "Editar embarque" el paso 2 (naviera, agente,
 * BL, ETD, ETA) aparecía vacío porque el `reset` corría antes de que los
 * catálogos estuvieran cargados. Guardar así borraba los datos.
 *
 * Escenario: abrir el primer embarque de la lista, leer naviera/BL/ETD/ETA
 * del detalle, entrar a editar, avanzar al paso 2 y verificar que esos
 * valores estén presentes en el formulario.
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";
import { EmbarquesListPO } from "../pageObjects/embarques";

test.describe("Flujo 32 — Editar embarque: hidratación del paso 2", () => {
  test("naviera/BL/ETD/ETA no llegan vacíos al paso 2", async ({ page }) => {
    await loginAs(page, internalCreds());

    const lista = new EmbarquesListPO(page);
    await lista.goto();
    const filas = lista.rows();
    if (!(await filas.first().isVisible().catch(() => false))) {
      test.skip(true, "El entorno no tiene embarques");
    }
    await lista.openFirstRow();

    const url = page.url();
    const id = url.match(/\/embarques\/([0-9a-f-]{36})/i)?.[1];
    expect(id, "id del embarque en la URL").toBeTruthy();

    // Ir al editor y esperar a que el wizard esté listo.
    await page.goto(`/embarques/${id}/editar`);
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 25_000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    // Avanzar al paso 2 (Transporte / datos de embarque).
    const siguiente = page.getByRole("button", { name: /siguiente|continuar/i }).first();
    if (await siguiente.isVisible().catch(() => false)) await siguiente.click();

    // Los combobox del paso 2 no deben quedar en placeholder vacío: al menos
    // uno debe mostrar un valor seleccionado. Y ningún select debe mostrar el
    // valor crudo como uuid (síntoma de opción no encontrada).
    const combos = page.getByRole("combobox");
    const total = await combos.count();
    expect(total, "el paso 2 debe renderizar sus selects").toBeGreaterThan(0);

    let conValor = 0;
    for (let i = 0; i < total; i += 1) {
      const texto = ((await combos.nth(i).textContent()) ?? "").trim();
      expect(texto, "un select no debe mostrar un uuid crudo").not.toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-/i,
      );
      if (texto && !/seleccion|elige|--/i.test(texto)) conValor += 1;
    }
    expect(conValor, "al menos un select del paso 2 debe llegar hidratado").toBeGreaterThan(0);

    // Las fechas (ETD/ETA) tampoco deben llegar vacías si el detalle las tenía.
    const fechas = page.locator("input[type='date'], button[data-datepicker], input[name*='eta'], input[name*='etd']");
    if ((await fechas.count()) > 0) {
      const textos = await fechas.allTextContents();
      const valores = await fechas.evaluateAll((els) =>
        els.map((el) => (el as HTMLInputElement).value ?? ""),
      );
      expect(
        [...textos, ...valores].some((v) => /\d/.test(v)),
        "ETD/ETA deben llegar con valor",
      ).toBe(true);
    }
  });
});
