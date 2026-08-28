import { describe, it, expect, vi, beforeEach } from "vitest";

const { from, deleteEq, rpc } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ error: null }),
  deleteEq: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc } }));

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
  conceptos: [{ descripcion: "Servicio", cantidad: 2, precio_unitario: 50, clave_sat: "78101800" }],
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

  it("α.1 — rechaza concepto sin clave SAT (ya no hay fallback silencioso)", async () => {
    await expect(
      crearFacturaManual({
        ...baseInput,
        conceptos: [{ descripcion: "Sin clave", cantidad: 1, precio_unitario: 10 }],
      }),
    ).rejects.toThrow(/clave SAT/i);
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
    expect(rpc).toHaveBeenCalledWith("soft_delete_record", { _table: "facturas", _id: "F-1" });
  });

  it("FIX-17 — totales cuadran al centavo con montos difíciles (0.1, 33.333, 1/3)", async () => {
    await crearFacturaManual({
      ...baseInput,
      conceptos: [
        { descripcion: "a", cantidad: 1, precio_unitario: 0.1, clave_sat: "12345678" },
        { descripcion: "b", cantidad: 3, precio_unitario: 33.333, clave_sat: "12345678" },
        { descripcion: "c", cantidad: 1, precio_unitario: 1 / 3, clave_sat: "12345678" },
        { descripcion: "d", cantidad: 2, precio_unitario: 99.995, clave_sat: "12345678" },
        { descripcion: "e", cantidad: 7, precio_unitario: 12.345, clave_sat: "12345678" },
      ],
    });
    const rows = conceptosPayload as Array<{ total: number }>;
    const p = insertPayload as Record<string, number>;
    const sumLineas = rows.reduce((s, r) => s + r.total, 0);
    // El encabezado debe ser Σ exacto de líneas (al centavo).
    expect(Math.round(p.subtotal * 100)).toBe(Math.round(sumLineas * 100));
    expect(Math.round((p.subtotal + p.iva) * 100)).toBe(Math.round(p.total * 100));
  });

  it("FIX-17 — rechaza cantidad NaN mencionando el campo", async () => {
    await expect(
      crearFacturaManual({
        ...baseInput,
        conceptos: [{ descripcion: "x", cantidad: NaN, precio_unitario: 10, clave_sat: "12345678" }],
      }),
    ).rejects.toThrow(/cantidad/i);
  });

  it("FIX-17 — rechaza precio_unitario Infinity", async () => {
    await expect(
      crearFacturaManual({
        ...baseInput,
        conceptos: [{ descripcion: "x", cantidad: 1, precio_unitario: Infinity, clave_sat: "12345678" }],
      }),
    ).rejects.toThrow(/precio_unitario/i);
  });

  it("FIX-17 — folio borrador incluye entropía UUID", async () => {
    await crearFacturaManual(baseInput);
    const p = insertPayload as Record<string, string>;
    expect(p.numero).toMatch(/^BORRADOR-[0-9a-z]+-[0-9a-f]{6}$/);
  });
});
