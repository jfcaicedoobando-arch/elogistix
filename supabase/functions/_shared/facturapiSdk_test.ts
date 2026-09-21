/**
 * P2-C · Contract tests del adaptador del SDK FacturAPI 5.0.
 *
 * Sin red y sin credenciales: se valida el CONTRATO (forma de la superficie y
 * de los tipos) contra un doble estructural equivalente al cliente del SDK v5
 * y contra clientes incompletos, que deben fallar con un error claro.
 */
import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  asFacturapiApi,
  exigirInvoices,
  exigirOperacion,
  exigirWebhooks,
  esContratoSdkError,
  cuerpoContratoSdk,
  FacturapiSdkContratoError,
  type FacturapiPaymentSummary,
  type FacturapiSearchResult,
} from "./facturapiSdk.ts";

/** Doble del cliente del SDK v5 con las operaciones que el ERP usa. */
function clienteFake() {
  const llamadas: string[] = [];
  const invoices = {
    self: "invoices" as const,
    create(payload: unknown) {
      llamadas.push("create");
      assert(this.self === "invoices", "create debe conservar su `this`");
      return Promise.resolve({ id: "inv_1", status: "valid", uuid: "u", external_id: (payload as { external_id?: string }).external_id });
    },
    retrieve: (id: string) => Promise.resolve({ id, status: "valid" }),
    list: (): Promise<FacturapiSearchResult<{ id: string }>> =>
      Promise.resolve({ data: [{ id: "inv_1" }], total_results: 1 }),
    cancel: (id: string) => Promise.resolve({ id, status: "canceled" }),
    paymentSummary: (_id: string, params: { amount: number }): Promise<FacturapiPaymentSummary> =>
      Promise.resolve({ installment: 1, last_balance: 100, amount: params.amount, currency: "MXN", taxes: [] }),
  };
  const webhooks = {
    list: () => Promise.resolve({ data: [{ id: "wh_1", url: "https://x/y", events: ["invoice.status_updated"] }] }),
    retrieve: (id: string) => Promise.resolve({ id }),
  };
  return { cliente: { invoices, webhooks }, llamadas };
}

Deno.test("asFacturapiApi acepta el cliente del SDK v5", () => {
  const { cliente } = clienteFake();
  const api = asFacturapiApi(cliente);
  assert(api.invoices);
  assert(api.webhooks);
});

Deno.test("asFacturapiApi rechaza un cliente sin `invoices`", () => {
  assertThrows(() => asFacturapiApi({}), FacturapiSdkContratoError, "invoices");
  assertThrows(() => asFacturapiApi(null), FacturapiSdkContratoError);
  assertThrows(() => asFacturapiApi({ invoices: "nope" }), FacturapiSdkContratoError);
});

Deno.test("exigirInvoices valida todas las operaciones usadas por el ERP", () => {
  const { cliente } = clienteFake();
  const invoices = exigirInvoices(cliente, "create", "retrieve", "list", "cancel", "paymentSummary");
  assertEquals(typeof invoices.create, "function");
});

Deno.test("exigirInvoices falla con mensaje accionable si falta una operación", () => {
  const err = assertThrows(
    () => exigirInvoices({ invoices: { create: () => Promise.resolve({}) } }, "create", "paymentSummary"),
    FacturapiSdkContratoError,
  ) as FacturapiSdkContratoError;
  assertEquals(err.operacion, "invoices.paymentSummary");
  assert(err.message.includes("npm:facturapi@5.1.0"));
  assertEquals(err.status, 500);
});

Deno.test("exigirOperacion devuelve la función ligada al namespace", async () => {
  const { cliente, llamadas } = clienteFake();
  const api = asFacturapiApi(cliente);
  const create = exigirOperacion<(p: unknown) => Promise<{ external_id?: string }>>(api, "invoices.create");
  const inv = await create({ external_id: "PENDING:abc" });
  assertEquals(inv.external_id, "PENDING:abc");
  assertEquals(llamadas, ["create"]);
});

Deno.test("paymentSummary recibe amount y responde el shape de v5", async () => {
  const { cliente } = clienteFake();
  const invoices = exigirInvoices(cliente, "paymentSummary");
  const resumen = await invoices.paymentSummary("inv_1", { amount: 58 });
  assertEquals(resumen.amount, 58);
  assertEquals(resumen.installment, 1);
  assertEquals(resumen.currency, "MXN");
});

Deno.test("SearchResult de v5 admite total_pages ausente", async () => {
  const { cliente } = clienteFake();
  const invoices = exigirInvoices(cliente, "list");
  const res = await invoices.list({ page: 1 });
  assertEquals(res.total_pages, undefined);
  assertEquals(res.data.length, 1);
});

Deno.test("exigirWebhooks falla claro cuando el SDK/plan no expone webhooks", () => {
  const { cliente } = clienteFake();
  assertEquals(typeof exigirWebhooks(cliente).list, "function");
  const err = assertThrows(
    () => exigirWebhooks({ invoices: {} }),
    FacturapiSdkContratoError,
  ) as FacturapiSdkContratoError;
  assertEquals(err.operacion, "webhooks");
});

Deno.test("los cuatro métodos usados por el ERP están cubiertos por el contrato", () => {
  const { cliente } = clienteFake();
  const invoices = exigirInvoices(cliente, "create", "list", "paymentSummary", "cancel");
  for (const m of ["create", "list", "paymentSummary", "cancel"] as const) {
    assertEquals(typeof invoices[m], "function");
  }
});

Deno.test("cuerpoContratoSdk es recuperable, diagnosticable y sin reintento automático", () => {
  const err = assertThrows(
    () => exigirInvoices({ invoices: {} }, "create"),
    FacturapiSdkContratoError,
  ) as FacturapiSdkContratoError;
  assert(esContratoSdkError(err));
  assertEquals(esContratoSdkError(new Error("otro")), false);
  const r = cuerpoContratoSdk(err, "PENDING:abc");
  assertEquals(r.status, 503);
  assertEquals(r.body.error, "facturapi_sdk_contrato");
  assertEquals(r.body.operacion, "invoices.create");
  assertEquals(r.body.reintento_automatico, false);
  assertEquals(r.body.reintentable, true);
  assertEquals(r.body.external_id, "PENDING:abc");
  assertEquals(cuerpoContratoSdk(err).body.external_id, null);
});
