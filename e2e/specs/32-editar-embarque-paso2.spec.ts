/** Lectura únicamente: compara TODOS los valores con una semilla marítima. */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";
import { supabaseRest } from "../fixtures/api";
import { requireFixture } from "../fixtures/requireFixture";

const EMBARQUE_ID = process.env.E2E_EMBARQUE_EDITAR_ID ?? "";
const displayDate = (iso: unknown) => String(iso).slice(0, 10).split("-").reverse().join("/");

test.describe("Flujo 32 — Hidratación con catálogos tardíos", () => {
  test("conserva naviera, agente, ambos BL y ambas fechas", async ({ page }) => {
    requireFixture(Boolean(EMBARQUE_ID), "E2E_EMBARQUE_EDITAR_ID marítimo completo requerido");
    await loginAs(page, internalCreds());
    const rest = supabaseRest(page);
    const rows = await rest.select("embarques", { id: EMBARQUE_ID, deleted_at: "is.null" }, "id,modo,naviera_id,agente_id,bl_master,bl_house,etd,eta");
    expect(rows).toHaveLength(1);
    const saved = rows[0];
    expect(saved.modo).toBe("Marítimo");
    for (const field of ["naviera_id", "agente_id", "bl_master", "bl_house", "etd", "eta"]) expect(saved[field], "semilla completa: " + field).toBeTruthy();
    const [naviera] = await rest.select("navieras", { id: String(saved.naviera_id) }, "id,name");
    const [agente] = await rest.select("costeo_agentes", { id: String(saved.agente_id) }, "id,nombre");
    expect(naviera?.name).toBeTruthy();
    expect(agente?.nombre).toBeTruthy();

    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const intercepted = new Set<string>();
    await page.route("**/rest/v1/{navieras,costeo_agentes}?**", async route => {
      const response = await route.fetch();
      intercepted.add(new URL(route.request().url()).pathname);
      await gate;
      await route.fulfill({ response });
    });
    try {
      await page.goto("/embarques/" + EMBARQUE_ID + "/editar");
      await page.getByRole("button", { name: /siguiente|continuar/i }).click();
      await expect.poll(() => intercepted.size, { message: "ambos catálogos respondieron, todavía retenidos" }).toBe(2);
      release();
      const selectFor = (label: RegExp) => page.locator("label").filter({ hasText: label }).locator("../..").getByRole("combobox");
      await expect(selectFor(/^Naviera/)).toHaveText(String(naviera.name));
      await expect(selectFor(/^Agente/)).toHaveText(String(agente.nombre));
      await expect(page.locator("#emb-bl-master")).toHaveValue(String(saved.bl_master));
      await expect(page.locator("#emb-bl-house")).toHaveValue(String(saved.bl_house));
      await expect(page.locator("#emb-etd")).toHaveValue(displayDate(saved.etd));
      await expect(page.locator("#emb-eta")).toHaveValue(displayDate(saved.eta));
      // Nunca pulsa Guardar: comprobar hidratación no necesita alterar registros.
    } finally {
      release();
      await page.unroute("**/rest/v1/{navieras,costeo_agentes}?**");
    }
  });
});
