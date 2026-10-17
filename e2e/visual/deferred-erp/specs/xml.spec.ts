import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { installNetworkGuards, capture } from "./helpers";

const FACTURA = "11111111-1111-4111-8111-111111111111";
const NC = "22222222-2222-4222-8222-222222222222";
// Exact fictitious inline XML from validarNcProveedor_test.ts; no fixture server.
const xml = `<cfdi:Comprobante Version="4.0" TipoDeComprobante="E" Moneda="MXN" Total="58" SubTotal="50" Fecha="2026-10-04T12:00:00"><cfdi:CfdiRelacionados TipoRelacion="01"><cfdi:CfdiRelacionado UUID="${FACTURA}"/></cfdi:CfdiRelacionados><cfdi:Emisor Rfc="AAA010101AAA"/><cfdi:Receptor Rfc="BBB010101BBB"/><tfd:TimbreFiscalDigital UUID="${NC}"/></cfdi:Comprobante>`;
const file = { name: "nota-ficticia.xml", mimeType: "application/xml", buffer: Buffer.from(xml) };
const pdf = { name: "nota-ficticia.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 fictitious-local-fixture") };

async function open(page: Page, scenario: string) {
  await page.goto(`/?case=xml&xmlScenario=${scenario}`);
  await page.getByTestId("open-xml").click();
  await expect(page.getByRole("dialog", { name: "Registrar nota de crédito" })).toBeVisible();
  await page.getByRole("button", { name: "Cargar XML CFDI", exact: true }).click();
  await page.locator('input[type="file"][accept*=".xml"]').setInputFiles(file);
  await expect(page.getByRole("button", { name: "Registrar", exact: true })).toBeDisabled();
}
async function process(page: Page) {
  await page.getByRole("button", { name: "Procesar XML", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__xmlEvidence.parses.length)).toBe(1);
  await expect(page.getByRole("button", { name: "Procesar XML", exact: true })).toBeEnabled();
}
async function evidence(page: Page, testInfo: TestInfo, network: Awaited<ReturnType<typeof installNetworkGuards>>, assertions: string[]) {
  expect(network.blocked).toEqual([]);
  expect(network.errors).toEqual([]);
  const state = await page.evaluate(() => window.__xmlEvidence);
  expect(state.guardFailures).toEqual([]);
  expect(state.parses.every(call => call.contentMatches && call.facturaId === FACTURA)).toBe(true);
  await testInfo.attach("xml-assertions-network", { body: JSON.stringify({ assertions, fixture: state, network }, null, 2), contentType: "application/json" });
}

test("XML 96: factura coincidente prellena y sólo escribe en memoria", async ({ page, context }, testInfo) => {
  const network = await installNetworkGuards(context, page);
  await open(page, "matching");
  await page.locator('input[type="file"][accept="application/pdf"]').setInputFiles(pdf);
  await process(page);
  await expect(page.getByLabel("Folio NC *", { exact: true })).toHaveValue("NC-1");
  await expect(page.getByLabel("Monto *", { exact: true })).toHaveValue("58.00");
  await expect(page.getByLabel("Base sin impuestos *", { exact: true })).toHaveValue("50.00");
  await expect(page.getByText(/Los campos fueron prellenados/)).toBeVisible();
  const register = page.getByRole("button", { name: "Registrar", exact: true });
  await expect(register).toBeEnabled();
  await capture(page, testInfo, "xml-matching-prefill");
  expect(await page.evaluate(() => window.__xmlEvidence.writes.length)).toBe(0);
  await register.click();
  await expect.poll(() => page.evaluate(() => window.__xmlEvidence.writes.length)).toBe(1);
  const state = await page.evaluate(() => window.__xmlEvidence);
  expect(state.writes[0]).toMatchObject({ proveedor_factura_id: FACTURA, uuid_fiscal: NC, monto: 58, subtotal: 50 });
  expect(state.uploads).toEqual([{ ncId: "xml-fixture-nc", organizationId: state.parses[0].organizationId, xmlName: file.name, pdfName: pdf.name }]);
  await evidence(page, testInfo, network, ["matching factura_id enables prefill and Registrar", "no write before explicit Registrar", "writer and attachment adapter record only in memory"]);
});

for (const scenario of ["missing", "different"] as const) {
  test(`XML 96: validación ${scenario} bloquea precarga y registro`, async ({ page, context }, testInfo) => {
    const network = await installNetworkGuards(context, page);
    await open(page, scenario);
    await process(page);
    await expect(page.getByLabel("Folio NC *", { exact: true })).toHaveValue("");
    await expect(page.getByRole("button", { name: "Registrar", exact: true })).toBeDisabled();
    await expect(page.getByText("No se pudo verificar el XML contra esta factura. Vuelve a procesarlo.", { exact: true })).toBeVisible();
    await capture(page, testInfo, `xml-validation-${scenario}`);
    expect(await page.evaluate(() => window.__xmlEvidence.writes)).toEqual([]);
    expect(await page.evaluate(() => window.__xmlEvidence.uploads)).toEqual([]);
    await evidence(page, testInfo, network, ["missing or different factura_id does not prefill", "identity failure visible", "Registrar disabled; no memory writes/uploads"]);
  });
}

test("XML 96: rechazo visible conserva captura manual sin UUID ni adjuntos", async ({ page, context }, testInfo) => {
  const network = await installNetworkGuards(context, page);
  await open(page, "rejected");
  await process(page);
  await expect(page.getByText("El RFC emisor del XML no corresponde al proveedor de la factura seleccionada.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar", exact: true })).toBeDisabled();
  await capture(page, testInfo, "xml-rejected");
  await page.getByRole("button", { name: "Captura manual", exact: true }).click();
  await page.getByLabel("Folio NC *", { exact: true }).fill("MANUAL-FICTICIA");
  await page.getByLabel("Monto *", { exact: true }).fill("10");
  await page.getByLabel("Base sin impuestos *", { exact: true }).fill("10");
  await expect(page.getByRole("button", { name: "Registrar", exact: true })).toBeEnabled();
  await capture(page, testInfo, "xml-manual-available");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__xmlEvidence.writes.length)).toBe(1);
  expect(await page.evaluate(() => window.__xmlEvidence.writes[0])).toMatchObject({ uuid_fiscal: null, monto: 10 });
  expect(await page.evaluate(() => window.__xmlEvidence.uploads)).toEqual([]);
  await evidence(page, testInfo, network, ["parser rejection visible and blocks XML", "manual capture remains available", "manual writer has null UUID and no attachments"]);
});

test("XML 96: retirar XML invalida UUID, validación y ambos adjuntos", async ({ page, context }, testInfo) => {
  const network = await installNetworkGuards(context, page);
  await open(page, "matching");
  await page.locator('input[type="file"][accept="application/pdf"]').setInputFiles(pdf);
  await process(page);
  await expect(page.getByRole("button", { name: "Registrar", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Quitar XML", exact: true }).click();
  await expect(page.getByText(file.name, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Quitar PDF", exact: true })).toHaveCount(0);
  await expect(page.getByText(/Los campos fueron prellenados/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Registrar", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Procesar XML", exact: true })).toBeDisabled();
  await capture(page, testInfo, "xml-removed-invalidated");
  await page.locator('input[type="file"][accept*=".xml"]').setInputFiles(file);
  await expect(page.getByRole("button", { name: "Procesar XML", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Registrar", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.__xmlEvidence.parses.length)).toBe(1);
  await capture(page, testInfo, "xml-reselected-requires-processing");
  await page.getByRole("button", { name: "Procesar XML", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__xmlEvidence.parses.length)).toBe(2);
  await expect(page.getByRole("button", { name: "Registrar", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Quitar XML", exact: true }).click();
  // Moving to manual proves the retained editable amounts cannot leak old UUID/files.
  await page.getByRole("button", { name: "Captura manual", exact: true }).click();
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__xmlEvidence.writes.length)).toBe(1);
  expect(await page.evaluate(() => window.__xmlEvidence.writes[0].uuid_fiscal)).toBeNull();
  expect(await page.evaluate(() => window.__xmlEvidence.uploads)).toEqual([]);
  await evidence(page, testInfo, network, ["remove clears XML/PDF and validation", "reselecting same XML requires processing again", "stale UUID and files do not leak into manual writer"]);
});
