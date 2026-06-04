import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/facturas", () => ({
  fetchLayoutContableData: vi.fn(),
}));
vi.mock("@/generators/exportCsv", () => ({
  exportToCsv: vi.fn(),
}));

import { exportarLayoutContable } from "../layoutContable";
import { fetchLayoutContableData } from "@/services/facturas";
import { exportToCsv } from "@/generators/exportCsv";

const mockFetch = fetchLayoutContableData as ReturnType<typeof vi.fn>;
const mockExport = exportToCsv as ReturnType<typeof vi.fn>;

const FACTURAS_LIST = [{ id: "f1" }, { id: "f2" }] as Parameters<typeof exportarLayoutContable>[0];

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    facturas: [
      {
        id: "f1",
        numero: "FAC-001",
        fecha_emision: "2024-03-01",
        subtotal: "1000",
        iva: "160",
        total: "1160",
        moneda: "MXN",
        tipo_cambio: "1",
        cliente_id: "cl1",
        cliente_nombre: "Cliente Uno",
        expediente: "EXP-001",
        referencia_bl: null,
        estado: "emitida",
      },
    ],
    rfcByClienteId: new Map([["cl1", "XAXX010101000"]]),
  });
});

describe("exportarLayoutContable", () => {
  it("llama a exportToCsv con filas mapeadas correctamente", async () => {
    await exportarLayoutContable(FACTURAS_LIST);
    expect(mockExport).toHaveBeenCalledOnce();
    const [filename, , rows] = mockExport.mock.calls[0] as [string, unknown, Record<string, string>[]];
    expect(filename).toMatch(/layout_contable_.*\.csv/);
    expect(rows[0].folio).toBe("FAC-001");
    expect(rows[0].rfc).toBe("XAXX010101000");
    expect(rows[0].tipo_comprobante).toBe("I");
  });

  it("no llama a exportToCsv si la lista de facturas está vacía", async () => {
    await exportarLayoutContable([]);
    expect(mockExport).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("incluye periodo YYYY-MM derivado de fecha_emision", async () => {
    await exportarLayoutContable(FACTURAS_LIST);
    const [, , rows] = mockExport.mock.calls[0] as [string, unknown, Record<string, string>[]];
    expect(rows[0].periodo).toBe("2024-03");
  });
});
