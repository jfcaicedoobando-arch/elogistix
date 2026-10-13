import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("./_softDeleteReadMock");
  return createSoftDeleteReadMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));
import { fetchFiltrosTarifaCotizacion } from "@/features/cotizacion/services/filtrosTarifaCotizacion";
import { fetchOrigenLclManual } from "@/features/embarques/services/origenLclManual";
import { fetchClienteFiscal } from "@/features/facturacion/services/datosFiscalesCliente";

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

describe("errores de lectura no se convierten en datos vivos", () => {
  it.each([
    { table: "cotizaciones", run: () => fetchFiltrosTarifaCotizacion("cot1") },
    { table: "cotizaciones", run: () => fetchOrigenLclManual("cot1") },
    { table: "clientes", run: () => fetchClienteFiscal("cli1") },
  ])("propaga error de $table", async ({ table, run }) => {
    mock.queue(table, null, new Error("lectura-fallida"));
    await expect(run()).rejects.toThrow("lectura-fallida");
    expect(mock.tableCalls).toHaveLength(1);
  });
});
