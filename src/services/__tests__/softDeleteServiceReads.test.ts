import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("./_softDeleteReadMock");
  return createSoftDeleteReadMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));
import { fetchFiltrosTarifaCotizacion } from "@/features/cotizacion/services/filtrosTarifaCotizacion";
import { fetchOrigenLclManual } from "@/features/embarques/services/origenLclManual";
import { prevalidarVinculosCosto } from "@/features/cxp/services/prevalidarVinculosCosto";
import { fetchClienteFiscal } from "@/features/facturacion/services/datosFiscalesCliente";
import { monedaDeCuenta, sugerirCandidatosDetalle } from "@/features/tesoreria/services/sugerirCandidatos";
import type { MovimientoBBVA } from "@/features/tesoreria/services/conciliacion";

const deleted_at = "2026-10-01T00:00:00Z";
beforeEach(() => mock.reset());
const vivo = (index = 0) => {
  const call = mock.tableCalls[index];
  expect(call.ops.some((op, i) => op === "is" && call.opArgs[i][0] === "deleted_at" && call.opArgs[i][1] === null)).toBe(true);
};

describe("lecturas de origen de cotización", () => {
  it("conserva ruta y contenedor de una cotización viva", async () => {
    mock.queue("cotizaciones", { tarifa_id: "t1" });
    mock.queue("costeo_tarifas", { tipo_contenedor_id: "tc1", costeo_rutas: { puerto_origen_id: "po", puerto_destino_id: "pd" } });
    expect(await fetchFiltrosTarifaCotizacion("cot1")).toEqual({ puertoOrigenId: "po", puertoDestinoId: "pd", tipoContenedorId: "tc1" });
    vivo();
    expect(mock.tableCalls[0].opArgs).toContainEqual(["id", "cot1"]);
  });
  it.each([null, { tarifa_id: "t1", deleted_at }])("sin cotización viva no consulta la tarifa: %j", async row => {
    mock.queue("cotizaciones", row);
    expect(await fetchFiltrosTarifaCotizacion("cot1")).toEqual({});
    vivo(); expect(mock.tableCalls).toHaveLength(1);
  });
  it("conserva la captura LCL manual viva", async () => {
    mock.queue("cotizaciones", { id: "cot1", folio: "C-TEST", lcl_tarifa_wm: 90, lcl_minimo_flete: 100,
      volumen_m3: 2, peso_kg: 1000, proveedores: { nombre: "Consolidador ficticio" } });
    expect(await fetchOrigenLclManual("cot1")).toEqual({ cotizacionId: "cot1", folio: "C-TEST", tarifaWm: 90,
      minimo: 100, volumenM3: 2, pesoKg: 1000, consolidador: "Consolidador ficticio" });
    vivo(); expect(mock.tableCalls[0].opArgs).toContainEqual(["id", "cot1"]);
  });
  it.each([null, { id: "cot1", lcl_tarifa_wm: 90, deleted_at }])("no devuelve LCL ausente/borrado: %j", async row => {
    mock.queue("cotizaciones", row);
    expect(await fetchOrigenLclManual("cot1")).toBeNull(); vivo();
  });
});

describe("prevalidación de costos", () => {
  const costo = { id: "c1", concepto: "Flete", monto: 100, moneda: "MXN" };
  const run = () => prevalidarVinculosCosto("org-test", "MXN", { c1: { monto: 50 } });
  const queue = (rows: unknown[]) => {
    mock.queue("conceptos_costo", rows);
    mock.queue("proveedor_facturas_conceptos", []);
  };
  it("acepta el costo vivo y conserva los dos filtros tenant", async () => {
    queue([costo]); await expect(run()).resolves.toBeUndefined(); vivo();
    for (const call of mock.tableCalls) expect(call.opArgs).toContainEqual(["organization_id", "org-test"]);
    expect(mock.tableCalls[0].opArgs).toContainEqual(["id", ["c1"]]);
    expect(mock.tableCalls[1].opArgs).toContainEqual(["concepto_costo_id", ["c1"]]);
  });
  it.each([{ rows: [] }, { rows: [{ ...costo, deleted_at }] }])("rechaza selección ausente/borrada: %j", async ({ rows }) => {
    queue(rows); await expect(run()).rejects.toThrow(/verificar todos los costos/); vivo();
  });
  it("sin selección no consulta tablas", async () => {
    await prevalidarVinculosCosto("org-test", "MXN", {}); expect(mock.tableCalls).toEqual([]);
  });
});

describe("datos fiscales del cliente", () => {
  const fiscal = { rfc: "XAXX010101000", codigo_postal: "01000", regimen_fiscal: "601", uso_cfdi_default: "G03" };
  it("conserva los datos de un cliente vivo", async () => {
    mock.queue("clientes", fiscal);
    expect(await fetchClienteFiscal("cli1")).toEqual(fiscal); vivo();
    expect(mock.tableCalls[0].opArgs).toContainEqual(["id", "cli1"]);
  });
  it.each([null, { ...fiscal, deleted_at }])("rechaza cliente ausente/borrado: %j", async row => {
    mock.queue("clientes", row);
    await expect(fetchClienteFiscal("cli1")).rejects.toThrow(/cliente ya no está disponible/); vivo();
    expect(mock.tableCalls).toHaveLength(1); expect(mock.rpcCalls).toEqual([]);
  });
});

describe("moneda de la cuenta bancaria", () => {
  it.each(["MXN", "USD", "EUR"])("conserva moneda %s de cuenta viva", async moneda => {
    mock.queue("cuentas_bancarias", { moneda });
    expect(await monedaDeCuenta("cta1")).toBe(moneda); vivo();
    expect(mock.tableCalls[0].opArgs).toContainEqual(["id", "cta1"]);
  });
  it.each([null, { moneda: "USD", deleted_at }])("sin cuenta viva no propone pagos: %j", async row => {
    mock.queue("cuentas_bancarias", row);
    const mov = { cargo: 100, abono: 0, fecha: "2026-10-01", cuenta_bancaria_id: "cta1" } as MovimientoBBVA;
    expect(await sugerirCandidatosDetalle(mov)).toEqual({ candidatos: [], truncado: false });
    vivo(); expect(mock.tableCalls).toHaveLength(1);
  });
  it("sin cuenta no consulta ni asume moneda", async () => {
    expect(await monedaDeCuenta(null)).toBeNull(); expect(mock.tableCalls).toEqual([]);
  });
});

describe("errores de lectura no se convierten en datos vivos", () => {
  it.each([
    { table: "cotizaciones", run: () => fetchFiltrosTarifaCotizacion("cot1") },
    { table: "cotizaciones", run: () => fetchOrigenLclManual("cot1") },
    { table: "clientes", run: () => fetchClienteFiscal("cli1") },
    { table: "cuentas_bancarias", run: () => monedaDeCuenta("cta1") },
  ])("propaga error de $table", async ({ table, run }) => {
    mock.queue(table, null, new Error("lectura-fallida"));
    await expect(run()).rejects.toThrow("lectura-fallida");
    expect(mock.tableCalls).toHaveLength(1);
  });
  it("prevalidación propaga el error del costo antes de aprobar vínculos", async () => {
    const error = new Error("lectura-costos"); mock.queue("conceptos_costo", null, error);
    mock.queue("proveedor_facturas_conceptos", []);
    await expect(prevalidarVinculosCosto("org-test", "MXN", { c1: { monto: 1 } })).rejects.toBe(error);
  });
});
