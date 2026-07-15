/**
 * Flujo 24 — Auditoría: la caché se invalida tras cambios (13.300.20).
 *
 * Antes: /auditoria mostraba hallazgos "stale" hasta pulsar Recalcular o
 * esperar 5 min. Ahora, tras subir un documento o cambiar estado, la
 * mutation debe invalidar `queryKeys.auditoria.embarques` y refetch al
 * volver a la ruta.
 *
 * Este smoke NO muta datos: solo verifica que al navegar dashboard →
 * auditoría se dispara el RPC `auditoria_embarques_org` (no viene de
 * caché fría) y que el spinner de refresh existe.
 */
import { expect, test } from "@playwright/test";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 24 — Auditoría · invalidación de caché", () => {
  test("navegar a /auditoria dispara el RPC y expone el botón Recalcular", async ({ page }) => {
    await loginAs(page, internalCreds());

    const rpcResp = page
      .waitForResponse(
        (r) => /\/rpc\/auditoria_embarques_org/i.test(r.url()) && r.request().method() === "POST",
        { timeout: 20_000 },
      )
      .catch(() => null);
    await page.goto("/auditoria");
    const resp = await rpcResp;
    expect(resp, "Debe dispararse la RPC de auditoría al entrar a la página").not.toBeNull();

    await expect(page.getByRole("heading", { name: /auditor[ií]a/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // El botón "Recalcular" (invalidateQueries manual) debe existir aunque
    // ahora las mutations invalidan automáticamente.
    await expect(
      page.getByRole("button", { name: /recalcular|actualizar/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Al hacer click, debe reejecutar la RPC.
    const rpcResp2 = page
      .waitForResponse(
        (r) => /\/rpc\/auditoria_embarques_org/i.test(r.url()) && r.request().method() === "POST",
        { timeout: 15_000 },
      )
      .catch(() => null);
    await page.getByRole("button", { name: /recalcular|actualizar/i }).first().click();
    const resp2 = await rpcResp2;
    expect(resp2, "Recalcular debe reejecutar la RPC de auditoría").not.toBeNull();
  });
});
