import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/facturacion/services", () => ({
  fetchLayoutContableData: vi.fn(),
}));
vi.mock("@/generators/exportCsv", () => ({
  exportToCsv: vi.fn(),
}));

import { exportarLayoutContable } from "../layoutContable";
import { fetchLayoutContableData } from "@/features/facturacion/services";
import { exportToCsv } from "@/generators/exportCsv";

const mockFetch = fetchLayoutContableData as ReturnType<typeof vi.fn>;
const mockExport = exportToCsv as ReturnType<typeof vi.fn>;

describe("exportarLayoutContable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("llama a exportToCsv con filas mapeadas correctamente", async () => {
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
          referencia_bl: "BL-001",
          estado: "emitida",
        },
      ],
      rfcByClienteId: new Map([["cl1", "XAXX010101000"]]),
    });

    await exportarLayoutContable([{ id: "f1" }] as any);
    expect(mockExport).toHaveBeenCalledOnce();
    const [filename, , rows] = mockExport.mock.calls[0];
    expect(filename).toMatch(/layout_contable_.*\.csv/);
    expect(rows[0].folio).toBe("FAC-001");
    expect(rows[0].rfc).toBe("XAXX010101000");
    expect(rows[0].referencia_bl).toBe("BL-001");
    expect(rows[0].periodo).toBe("2024-03");
  });

  it("maneja valores nulos y aplica defaults", async () => {
    mockFetch.mockResolvedValue({
      facturas: [
        {
          id: "f2",
          numero: "FAC-002",
          fecha_emision: null,
          subtotal: null,
          iva: null,
          total: null,
          moneda: "USD",
          tipo_cambio: null,
          cliente_id: null,
          cliente_nombre: null,
          expediente: null,
          referencia_bl: null,
          estado: "borrador",
        },
      ],
      rfcByClienteId: new Map(),
    });

    await exportarLayoutContable([{ id: "f2" }] as any);
    const [, , rows] = mockExport.mock.calls[0];
    expect(rows[0].periodo).toBe("");
    expect(rows[0].rfc).toBe("");
    expect(rows[0].razon_social).toBe("");
    expect(rows[0].subtotal).toBe("0.00");
    expect(rows[0].iva).toBe("0.00");
    expect(rows[0].total).toBe("0.00");
    expect(rows[0].tipo_cambio).toBe("1.0000"); // default 1
    expect(rows[0].expediente).toBe("");
    expect(rows[0].referencia_bl).toBe("");
  });

  it("usa cliente_id no mapeado en RFC map", async () => {
    mockFetch.mockResolvedValue({
      facturas: [{ id: "f3", cliente_id: "cl-not-found", total: "100" }],
      rfcByClienteId: new Map(),
    });
    await exportarLayoutContable([{ id: "f3" }] as any);
    const [, , rows] = mockExport.mock.calls[0];
    expect(rows[0].rfc).toBe("");
  });

  it("no llama a exportToCsv si la lista de facturas está vacía", async () => {
    await exportarLayoutContable([]);
    expect(mockExport).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
