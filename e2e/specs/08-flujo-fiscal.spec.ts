/**
 * Flujo 08 — Happy path fiscal (proforma → factura → timbrado → pago → REP).
 *
 * Este spec corre en SANDBOX: requiere que el tenant de staging tenga
 * configuradas las credenciales FacturApi sandbox y una proforma aprobada
 * lista para convertir. Por defecto está `skip` para no romper el smoke
 * de CI (ningún CI tiene la cuenta sandbox); úsalo manualmente:
 *
 *   E2E_FISCAL=1 E2E_PROFORMA_NUMERO=PRO-2026-XXXX npx playwright test 08
 *
 * v13.137.13 — cierra el pendiente 11 del plan fiscal.
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";
import { bestEffortCleanup } from "../fixtures/cleanup";
import { supabaseRest } from "../fixtures/api";
import { requireFixture } from "../fixtures/requireFixture";

const ENABLED = process.env.E2E_FISCAL === "1";
const PROFORMA = process.env.E2E_PROFORMA_NUMERO ?? "";

test.describe.configure({ mode: "serial" });

test.describe("Flujo 08 — Fiscal happy path", () => {
  requireFixture(ENABLED && Boolean(PROFORMA), "E2E_FISCAL=1 + E2E_PROFORMA_NUMERO requeridos");

  let facturaIdCreada: string | null = null;
  let lastPage: import("@playwright/test").Page | null = null;

  test.afterAll(async (_fixtures, testInfo) => {
    // Best-effort: cancelar CFDI sandbox motivo 02 (sin sustitución) y
    // borrar pagos locales asociados. Si no hay sesión disponible, nos rendimos.
    if (!facturaIdCreada || !lastPage) return;
    await bestEffortCleanup(testInfo, "cancelar CFDI sandbox (motivo 02)", async () => {
      await supabaseRest(lastPage!).rpc("cancelar_factura", {
        p_factura_id: facturaIdCreada,
        p_motivo: "02",
      });
    });
    await bestEffortCleanup(testInfo, "borrar pagos_factura E2E", async () => {
      await supabaseRest(lastPage!).delete("pagos_factura", { factura_id: facturaIdCreada! });
    });
  });


  test("proforma aprobada → convertir → timbrar → registrar pago PPD → REP", async ({ page }) => {
    await loginAs(page, internalCreds());
    lastPage = page;

    // 1. Entrar a facturación y localizar la proforma aprobada.
    await page.goto("/facturacion");
    await expect(page.getByRole("tab", { name: /por timbrar/i })).toBeVisible();
    await page.getByRole("tab", { name: /por timbrar/i }).click();

    const proformaRow = page.getByRole("row", { name: new RegExp(PROFORMA, "i") });
    await expect(proformaRow).toBeVisible({ timeout: 15_000 });

    // 2. Convertir a factura. Capturar el id que devuelve el RPC para cleanup.
    await proformaRow.getByRole("checkbox").check();
    const convertResp = page.waitForResponse(
      (r) => /\/rpc\/convertir_proformas_a_factura/i.test(r.url()) && r.ok(),
      { timeout: 25_000 },
    );
    await page.getByRole("button", { name: /convertir a factura/i }).click();
    await page.getByRole("button", { name: /^confirmar$/i }).click();
    const convertBody = await convertResp.then((r) => r.json().catch(() => null));
    const firstId = Array.isArray(convertBody) ? convertBody[0]?.factura_id ?? convertBody[0]?.id : null;
    if (typeof firstId === "string") facturaIdCreada = firstId;
    await expect(page.getByText(/factura.*creada/i)).toBeVisible({ timeout: 20_000 });

    // 3. Saltar a Emitidas y timbrar la primera Borrador. Capturamos el
    //    número de factura del row para re-localizarlo después del timbrado
    //    (el badge cambia de "Borrador" a "Timbrada" y rompe locators por estado).
    await page.getByRole("tab", { name: /emitidas/i }).click();
    const borradorRow = page.getByRole("row").filter({ hasText: /Borrador/i }).first();
    const facturaNumero = (await borradorRow.locator("td").first().innerText()).trim();
    await borradorRow.getByRole("button", { name: /timbrar/i }).click();
    await page.getByRole("button", { name: /^timbrar$/i }).click();
    await expect(page.getByText(/timbrada/i)).toBeVisible({ timeout: 30_000 });

    // 4. Registrar pago PPD usando un locator fresco por número de factura.
    const facturaRow = page.getByRole("row", { name: new RegExp(facturaNumero, "i") });
    await expect(facturaRow).toBeVisible({ timeout: 10_000 });
    await facturaRow.getByRole("button", { name: /registrar pago/i }).click();
    await page.getByLabel(/monto/i).fill("100");
    // `forma de pago` puede ser <select> nativo o un Radix Select. Probamos
    // la API nativa y, si no es un combobox nativo, abrimos el listbox de Radix.
    const formaPago = page.getByLabel(/forma de pago/i);
    const tagName = await formaPago.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
    if (tagName === "select") {
      await formaPago.selectOption({ label: /transferencia/i });
    } else {
      await formaPago.click();
      await page.getByRole("option", { name: /transferencia/i }).first().click();
    }
    await page.getByRole("button", { name: /guardar/i }).click();

    // El REP se timbra automáticamente vía edge function.
    await expect(page.getByText(/REP.*timbrado|Complemento.*timbrado/i)).toBeVisible({
      timeout: 45_000,
    });
  });
});

