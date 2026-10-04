import { expect, type Page, type TestInfo } from "@playwright/test";
import { supabaseRest } from "./api";

/** No basta E2E_FISCAL=1: comprobar el ambiente remoto antes de emitir. */
export async function requireSandbox(page: Page, organizationId: string) {
  const rows = await supabaseRest(page).select("facturapi_credenciales", { organization_id: organizationId }, "ambiente");
  expect(rows, "configuración fiscal única del tenant").toHaveLength(1);
  expect(rows[0].ambiente, "el E2E fiscal jamás debe emitir en Live").toBe("sandbox");
}

/** Se retienen CFDI/pagos mock: son evidencia fiscal, no basura para DELETE. */
export async function attachFiscalRecords(testInfo: TestInfo, ids: Record<string, unknown>) {
  await testInfo.attach("registros-fiscales-mock.json", {
    body: JSON.stringify(ids, null, 2), contentType: "application/json",
  });
}
