/**
 * Flujo 09 — Cierre de embarque (checklist + bypass admin_org).
 *
 * Requiere:
 *   E2E_EMBARQUE_CHECKLIST_INCOMPLETO_ID — UUID de un embarque con checklist
 *     incompleto en estado en_transito/arribado.
 *   E2E_ADMIN_ORG=1                       — (opcional) si el usuario E2E es
 *     admin_org, también prueba el cierre con bypass.
 *
 * v13.135.59 / v13.135.70 — cobertura del flujo de cierre y bypass.
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";
import { bestEffortCleanup } from "../fixtures/cleanup";
import { supabaseRest } from "../fixtures/api";
import { requireFixture } from "../fixtures/requireFixture";

const EMBARQUE_ID = process.env.E2E_EMBARQUE_CHECKLIST_INCOMPLETO_ID ?? "";
const IS_ADMIN_ORG = process.env.E2E_ADMIN_ORG === "1";

test.describe("Flujo 09 — Cierre de embarque", () => {
  requireFixture(Boolean(EMBARQUE_ID), "E2E_EMBARQUE_CHECKLIST_INCOMPLETO_ID requerido");

  let wasClosed = false;
  let lastPage: import("@playwright/test").Page | null = null;

  test.afterEach(async ({ page }, testInfo) => {
    if (!wasClosed) return;
    const target = lastPage ?? page;
    await bestEffortCleanup(testInfo, "reabrir embarque", async () => {
      await supabaseRest(target).rpc("reabrir_embarque", {
        p_embarque_id: EMBARQUE_ID,
        p_motivo: "cleanup E2E (spec 09)",
      });
    });
    wasClosed = false;
    lastPage = null;
  });

  test("checklist incompleto bloquea el cierre y muestra pendientes", async ({ page }) => {
    await loginAs(page, internalCreds());
    await page.goto(`/embarques/${EMBARQUE_ID}?tab=cierre`);

    await expect(page.getByRole("heading", { name: /cierre/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Card de pendientes debe listar ≥1 item.
    const pendientes = page.getByText(/pendiente|falta/i).first();
    await expect(pendientes).toBeVisible({ timeout: 10_000 });

    // Botón Cerrar embarque deshabilitado.
    const btnCerrar = page.getByRole("button", { name: /cerrar embarque/i });
    await expect(btnCerrar).toBeDisabled();

    // El tooltip envuelve un span; hover debe revelar el motivo.
    await btnCerrar.hover();
    await expect(
      page.getByRole("tooltip").filter({ hasText: /falta|pendient|checklist/i }).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("admin_org puede cerrar con bypass", async ({ page }) => {
    requireFixture(IS_ADMIN_ORG, "E2E_ADMIN_ORG=1 requerido para probar bypass");
    await loginAs(page, internalCreds());
    lastPage = page;
    await page.goto(`/embarques/${EMBARQUE_ID}?tab=cierre`);

    // El botón sigue deshabilitado UI pero admin puede forzar via toggle/confirm.
    const btnBypass = page
      .getByRole("button", { name: /cerrar.*bypass|forzar cierre|cerrar de todas formas/i })
      .first();
    await expect(btnBypass).toBeVisible({ timeout: 10_000 });
    await btnBypass.click();
    await page.getByRole("button", { name: /^confirmar$/i }).click();

    const rpc = await page
      .waitForResponse((r) => /\/rpc\/cerrar_embarque/i.test(r.url()) && r.ok(), {
        timeout: 20_000,
      })
      .catch(() => null);
    // Marcar wasClosed apenas la RPC responde OK — antes de cualquier assert
    // que pueda fallar y bloquear el cleanup.
    if (rpc) wasClosed = true;

    await expect(page.getByText(/cerrado/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
