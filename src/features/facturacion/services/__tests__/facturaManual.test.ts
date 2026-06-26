import { describe, it, expect, vi, beforeEach } from "vitest";

const { from, deleteEq } = vi.hoisted(() => ({
  from: vi.fn(),
  deleteEq: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

import { crearFacturaManual } from "../facturaManual";

const baseInput = {
  organizationId: "org",
  clienteId: "c",
  clienteNombre: "ACME",
  rfcCliente: "RFC",
  serie: "A",
  usoCfdi: "G03",
  formaPago: "03",
  metodoPago: "PUE",
  diasCredito: 30,
  fechaEmision: "2026-06-01",
  moneda: "MXN" as const,
  tipoCambio: 1,
  conceptos: [{ descripcion: "Servicio", cantidad: 2, precio_unitario: 50 }],
  tasaIva: 0.16,
};

describe("crearFacturaManual", () => {
  let insertPayload: unknown = null;
  let conceptosPayload: unknown = null;
  let errFact: { message: string } | null = null;
  let errConc: { message: string } | null = null;

  beforeEach(() => {
    insertPayload = null; conceptosPayload = null; errFact = null; errConc = null;
    from.mockReset();
    from.mockImplementation((table: string) => {
      if (table === "facturas") {
        return {
          insert: (p: unknown) => {
            insertPayload = p;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: errFact ? null : { id: "F-1" }, error: errFact }),
              }),
            };
          },
          delete: () => ({ eq: deleteEq }),
        };
      }
      if (table === "conceptos_factura") {
        return {
          insert: (p: unknown) => {
            conceptosPayload = p;
            return Promise.resolve({ error: errConc });
          },
        };
      }
      return {};
    });
    insertChain.mockReset();
    deleteEq.mockClear();
  });

  it("rechaza cuando no hay conceptos", async () => {
    await expect(crearFacturaManual({ ...baseInput, conceptos: [] })).rejects.toThrow("al menos un concepto");
  });

  it("calcula subtotal, IVA y total correctamente (2 * 50 = 100)", async () => {
    const id = await crearFacturaManual(baseInput);
    expect(id).toBe("F-1");
    const p = insertPayload as Record<string, number>;
    expect(p.subtotal).toBe(100);
    expect(p.iva).toBe(16);
    expect(p.total).toBe(116);
  });

  it("aplica fecha_vencimiento = fecha_emision + diasCredito", async () => {
    await crearFacturaManual(baseInput);
    const p = insertPayload as Record<string, string>;
    expect(p.fecha_vencimiento).toBe("2026-07-01");
  });

  it("usa clave SAT por default cuando no se especifica", async () => {
    await crearFacturaManual(baseInput);
    const rows = conceptosPayload as Array<{ clave_sat: string; cantidad: number }>;
    expect(rows[0].clave_sat).toBe("78101800");
    expect(rows[0].cantidad).toBe(2);
  });

  it("respeta clave SAT custom", async () => {
    await crearFacturaManual({ ...baseInput, conceptos: [{ descripcion: "x", cantidad: 1, precio_unitario: 10, clave_sat: "12345678" }] });
    const rows = conceptosPayload as Array<{ clave_sat: string }>;
    expect(rows[0].clave_sat).toBe("12345678");
  });

  it("lanza error legible cuando falla insert de factura", async () => {
    errFact = { message: "dup" };
    await expect(crearFacturaManual(baseInput)).rejects.toThrow(/Error al crear factura: dup/);
  });

  it("rollback: borra factura si falla insert de conceptos", async () => {
    errConc = { message: "no" };
    await expect(crearFacturaManual(baseInput)).rejects.toThrow(/Error al crear conceptos: no/);
    expect(deleteEq).toHaveBeenCalledWith("id", "F-1");
  });
});
