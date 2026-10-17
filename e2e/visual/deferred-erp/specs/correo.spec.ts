import { expect, test, type Page } from "@playwright/test";
import { capture, installNetworkGuards } from "./helpers";

type Audit = {
  scenario: string; organizationId: string; preparedType: string; legacyType: string;
  reads: { table: string; from: number; to: number; filters: [string, unknown][]; orders: string[]; count: number; error: string | null }[];
  writes: { kind: string; organizationId?: string; input: Record<string, unknown> }[];
  invocations: { name: string; organizationId: string }[];
};
const audit = async (page: Page): Promise<Audit> => JSON.parse(await page.getByTestId("correo-audit").textContent() ?? "{}");
const orgA = "10000000-0000-4000-8000-000000000001";
const orgB = "10000000-0000-4000-8000-000000000002";
const search = (page: Page) => page.getByRole("button", { name: "Buscar tarifas en el correo", exact: true });
const load = (page: Page, count: number) => page.getByRole("button", { name: `Cargar ${count} tarifa(s) en borrador`, exact: true });

test.describe("Correo PR372 · diálogo, parser, servicios y selección reales", () => {
  let network: Awaited<ReturnType<typeof installNetworkGuards>>;
  test.beforeEach(async ({ context, page }) => {
    network = await installNetworkGuards(context, page);
    await page.goto("/?case=correo");
  });
  test.afterEach(async ({ page }, testInfo) => {
    const snapshot = await audit(page);
    await testInfo.attach("correo-assertions-and-network", { body: JSON.stringify({ test: testInfo.title, status: testInfo.status, viewport: page.viewportSize(), assertions: snapshot, network }, null, 2), contentType: "application/json" });
    expect(network.blocked).toEqual([]);
    expect(network.errors).toEqual([]);
  });
  async function prepare(page: Page, scenario = "ready") {
    await page.getByLabel("Escenario de correo").selectOption(scenario);
    await page.getByRole("button", { name: "Abrir extracción ficticia" }).click();
    await search(page).click();
  }

  test("prepara sin escrituras ni conexiones a Gmail", async ({ page }, testInfo) => {
    await prepare(page);
    await expect(load(page, 1)).toBeEnabled();
    await page.getByRole("button", { name: /^Longsail.*1 tarifa/ }).click();
    await expect(page.getByText(/Fila 2: Shanghai.*Manzanillo.*Maersk sintética/)).toBeVisible();
    const state = await audit(page);
    expect(state.writes).toEqual([]);
    expect(state.invocations).toEqual([{ name: "extraer-tarifas-correo", organizationId: orgA }]);
    expect(state.reads.filter(row => row.table === "puertos").map(row => [row.from, row.to, row.count])).toEqual([[0, 999, 1000], [1000, 1999, 2]]);
    await capture(page, testInfo, "correo-preparacion-sin-escrituras");
  });

  test("excluye el conflicto de segunda página y conserva UUID preparado sólo por elección explícita", async ({ page }, testInfo) => {
    await prepare(page, "conflict-late");
    await expect(load(page, 0)).toBeDisabled();
    const conflict = page.getByRole("checkbox", { name: /Fila 2:/ });
    await expect(conflict).not.toBeChecked();
    await expect(page.getByText(/Ya existe una tarifa en borrador/)).toBeVisible();
    const prepared = await audit(page);
    expect(prepared.writes).toEqual([]);
    expect(prepared.reads.filter(row => row.table === "costeo_tarifas").map(row => [row.from, row.to, row.count])).toEqual([[0, 999, 1000], [1000, 1999, 1]]);
    for (const row of prepared.reads.filter(row => row.table === "costeo_tarifas")) {
      expect(row.filters).toEqual([["organization_id", orgA]]);
      expect(row.orders).toEqual(["id"]);
    }
    await capture(page, testInfo, "correo-conflicto-excluido-segunda-pagina");
    await conflict.check();
    await expect(load(page, 1)).toBeEnabled();
    await load(page, 1).click();
    await expect(page.getByText(/Se cargaron/)).toHaveText("Se cargaron 1 tarifa(s) en borrador.");
    const saved = await audit(page);
    expect(saved.writes).toHaveLength(1);
    expect(saved.writes[0]).toMatchObject({ kind: "tarifa", organizationId: orgA, input: { tipo_contenedor_id: prepared.preparedType, flete_base: 1000 } });
    expect(saved.writes[0].input.tipo_contenedor_id).not.toBe(prepared.legacyType);
    await capture(page, testInfo, "correo-confirmacion-escritor-en-memoria");
  });

  for (const scenario of ["error-conflicts", "error-catalog"]) {
    test(`${scenario}: error en segunda página bloquea carga y altas`, async ({ page }, testInfo) => {
      await prepare(page, scenario);
      await expect(page.getByText(/No se pudieron leer los correos: Fallo sintético en segunda página/)).toBeVisible();
      await expect(page.getByRole("button", { name: /Cargar|Dar de alta/ })).toHaveCount(0);
      await expect(page.getByRole("checkbox", { name: /Dar de alta/ })).toHaveCount(0);
      const state = await audit(page);
      expect(state.writes).toEqual([]);
      expect(state.reads.some(row => row.from === 1000 && row.error === "Fallo sintético en segunda página")).toBe(true);
      await capture(page, testInfo, `correo-${scenario}`);
    });
  }

  for (const scenario of ["inactive-global", "inactive-org"]) {
    test(`${scenario}: catálogo existente inactivo no se ofrece para alta ni importación`, async ({ page }, testInfo) => {
      await prepare(page, scenario);
      await expect(page.getByText(/origen.*Shanghai.*inactivo.*naviera.*MAEU.*inactiva/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /Cargar|Dar de alta/ })).toHaveCount(0);
      await expect(page.getByRole("checkbox", { name: /Dar de alta/ })).toHaveCount(0);
      expect((await audit(page)).writes).toEqual([]);
      await capture(page, testInfo, `correo-${scenario}`);
    });
  }

  test("cambio de organización invalida resultados y exige nueva extracción", async ({ page }, testInfo) => {
    await prepare(page);
    await expect(load(page, 1)).toBeEnabled();
    await page.keyboard.press("Alt+o");
    await expect(page.getByTestId("correo-organization")).toHaveText(`Organización: ${orgB}`);
    await expect(page.getByRole("button", { name: /Cargar/ })).toHaveCount(0);
    await expect(search(page)).toBeEnabled();
    expect((await audit(page)).writes).toEqual([]);
    await capture(page, testInfo, "correo-organizacion-invalida-extraccion");
    await search(page).click();
    await expect(load(page, 1)).toBeEnabled();
    const state = await audit(page);
    expect(state.invocations.map(row => row.organizationId)).toEqual([orgA, orgB]);
    const conflicts = state.reads.filter(row => row.table === "costeo_tarifas");
    const lastConflicts = conflicts[conflicts.length - 1];
    expect(lastConflicts?.filters).toEqual([["organization_id", orgB]]);
    await load(page, 1).click();
    await expect(page.getByText(/Se cargaron/)).toHaveText("Se cargaron 1 tarifa(s) en borrador.");
    expect((await audit(page)).writes).toMatchObject([{ kind: "tarifa", organizationId: orgB }]);
  });
});
