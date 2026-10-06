import { describe, it, expect, vi, beforeEach } from "vitest";

const { from, rpc } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc } }));

import { crearFacturaManual } from "../facturaManual";
import { construirLineasManuales } from "../facturaManualLineas";
import { calcularTotalesConceptos } from "@/features/facturacion/utils/totalesConceptos";
import { recalcularTotalesConceptos } from "../../../../../supabase/functions/facturapi-emitir/cuadreFiscal.ts";

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
    rpc.mockReset().mockImplementation((_name, args) => {
      insertPayload = args.p_factura;
      conceptosPayload = args.p_conceptos;
      return Promise.resolve({ data: errFact || errConc ? null : "F-1", error: errFact ?? errConc });
    });
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

  it("26: .3 × .11 muestra y persiste .03, con IVA redondeado a cero", async () => {
    const conceptos = [{ descripcion: "Prorrateo", cantidad: 0.3, precio_unitario: 0.11, clave_sat: "78101800" }];
    expect(calcularTotalesConceptos(conceptos, 0.16)).toEqual({ subtotal: 0.03, iva: 0, total: 0.03 });
    await crearFacturaManual({ ...baseInput, conceptos });
    expect(insertPayload).toMatchObject({ subtotal: 0.03, iva: 0, total: 0.03 });
    expect(conceptosPayload).toMatchObject([{ cantidad: 0.3, precio_unitario: 0.11, total: 0.03 }]);
  });

  it.each(["gravado_16", "gravado_8", "tasa_0", "exento", "no_objeto"] as const)(
    "26: preview, persistencia y preflight coinciden con fracciones y %s", async (tipo_iva) => {
      const conceptos = [
        { descripcion: "Fracción", cantidad: 0.3, precio_unitario: 0.11, clave_sat: "78101800", tipo_iva },
        { descripcion: "Dos líneas", cantidad: 2, precio_unitario: 1533.33, clave_sat: "78101800", tipo_iva },
        { descripcion: "Precisión fiscal", cantidad: 0.3333333, precio_unitario: 11.005, clave_sat: "78101800", tipo_iva },
      ];
      const preview = calcularTotalesConceptos(conceptos, 0.16);
      await crearFacturaManual({ ...baseInput, conceptos });
      expect(insertPayload).toMatchObject(preview);
      const lineas = construirLineasManuales(conceptos, 0.16);
      const preflight = recalcularTotalesConceptos(lineas.map((l) => ({
        descripcion: l.descripcion, cantidad: l.cantidad, precio_unitario: l.precio,
        tipo_iva: l.tipo_iva, tasa_iva: l.tasaFila,
      })));
      expect(preflight).toMatchObject({ subtotal: preview.subtotal, iva_trasladado: preview.iva, total: preview.total });
    },
  );

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

  it("rollback atómico: un fallo de conceptos no dispara borrado compensatorio desde cliente", async () => {
    errConc = { message: "no" };
    await expect(crearFacturaManual(baseInput)).rejects.toThrow(/Error al crear factura: no/);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
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
    expect(p.numero).toMatch(/^BORRADOR-[0-9a-f-]{36}$/);
  });
  it("AUD110: cada reintento conserva identidad, folio y payload de la misma captura", async () => {
    const input = { ...baseInput, requestId: "a1111111-1111-4111-8111-111111111111" };
    await crearFacturaManual(input);
    await crearFacturaManual(input);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc).toHaveBeenLastCalledWith("crear_factura_manual_idempotente", expect.objectContaining({ p_request_id: input.requestId }));
    expect(from).not.toHaveBeenCalled();
  });

});
