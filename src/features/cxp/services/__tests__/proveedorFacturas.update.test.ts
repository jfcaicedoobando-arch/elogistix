import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchFacturaParaEdicion,
  actualizarFacturaProveedor,
  SaldoNegativoError,
  type ActualizarFacturaPayload,
} from "../proveedorFacturas.update";

const baseActual = {
  id: "f1",
  proveedor_id: "p1",
  estado_aprobacion: "aprobada",
  folio_proveedor: "A-1",
  fecha_emision: "2026-01-01",
  moneda: "MXN",
  tipo_cambio_usd: 1,
  subtotal: 1000,
  iva: 160,
  ieps: 0,
  retenciones: 0,
};

const basePayload: ActualizarFacturaPayload = {
  folio_proveedor: "A-1",
  fecha_emision: "2026-01-01",
  fecha_vencimiento: "2026-02-01",
  dias_credito: 30,
  moneda: "MXN",
  tipo_cambio_usd: 1,
  subtotal: 1000,
  iva: 160,
  ieps: 0,
  retenciones: 0,
  categoria_presupuesto_id: "cat-1",
  notas: "ok",
};

describe("proveedorFacturas.update", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.resetResults();
  });

  describe("fetchFacturaParaEdicion", () => {
    it("retorna la fila cuando existe", async () => {
      mock.setTableResult("proveedor_facturas", { data: { id: "f1", proveedor_id: "p1" }, error: null });
      const r = await fetchFacturaParaEdicion("f1");
      expect(r?.id).toBe("f1");
    });

    it("retorna null cuando no hay data", async () => {
      mock.setTableResult("proveedor_facturas", { data: null, error: null });
      expect(await fetchFacturaParaEdicion("f1")).toBeNull();
    });

    it("propaga error del select", async () => {
      mock.setTableResult("proveedor_facturas", { data: null, error: { message: "no" } });
      await expect(fetchFacturaParaEdicion("f1")).rejects.toMatchObject({ message: "no" });
    });
  });

  describe("SaldoNegativoError", () => {
    it("incluye code y totalPagado", () => {
      const e = new SaldoNegativoError(123.45);
      expect(e.code).toBe("SALDO_NEGATIVO");
      expect(e.totalPagado).toBe(123.45);
      expect(e).toBeInstanceOf(Error);
    });
  });

  describe("actualizarFacturaProveedor", () => {
    it("retorna la fila actualizada en happy path sin cambios sensibles", async () => {
      // Lectura inicial, dup-check, update.select.single — todos vuelven al mismo result.
      // Como el read es .single() y el dup-check es awaitable, devolvemos el row crudo
      // para que el read funcione; dup-check leerá `.length` de un objeto (undefined > 0 = false).
      mock.setTableResult("proveedor_facturas", { data: baseActual, error: null });
      mock.setTableResult("pagos_proveedor", { data: [], error: null });

      const payload = { ...basePayload, notas: "nueva nota", categoria_presupuesto_id: "cat-2" };
      const r = await actualizarFacturaProveedor("f1", payload);
      expect(r).toBeTruthy();

      const updateCall = mock.tableCalls.find(
        (c) => c.table === "proveedor_facturas" && c.ops.includes("update"),
      );
      const updateBody = updateCall?.opArgs[updateCall.ops.indexOf("update")]?.[0] as Record<string, unknown>;
      expect(updateBody.total).toBe(1160);
      expect(updateBody.notas).toBe("nueva nota");
      // No hubo cambio sensible: NO debe forzar re-aprobación
      expect(updateBody.estado_aprobacion).toBeUndefined();
      expect(updateBody.aprobada_por).toBeUndefined();
    });

    it("fuerza re-aprobación cuando cambia un campo sensible y estaba aprobada", async () => {
      mock.setTableResult("proveedor_facturas", { data: baseActual, error: null });
      mock.setTableResult("pagos_proveedor", { data: [], error: null });

      await actualizarFacturaProveedor("f1", { ...basePayload, subtotal: 2000 });

      const updateCall = mock.tableCalls.find(
        (c) => c.table === "proveedor_facturas" && c.ops.includes("update"),
      );
      const body = updateCall?.opArgs[updateCall.ops.indexOf("update")]?.[0] as Record<string, unknown>;
      expect(body.estado_aprobacion).toBe("pendiente");
      expect(body.aprobada_por).toBeNull();
      expect(body.aprobada_at).toBeNull();
      expect(body.total).toBe(2160);
    });

    it("NO fuerza re-aprobación si el cambio sensible ocurre sobre una factura pendiente", async () => {
      mock.setTableResult("proveedor_facturas", {
        data: { ...baseActual, estado_aprobacion: "pendiente" },
        error: null,
      });
      mock.setTableResult("pagos_proveedor", { data: [], error: null });

      await actualizarFacturaProveedor("f1", { ...basePayload, subtotal: 2000 });

      const updateCall = mock.tableCalls.find(
        (c) => c.table === "proveedor_facturas" && c.ops.includes("update"),
      );
      const body = updateCall?.opArgs[updateCall.ops.indexOf("update")]?.[0] as Record<string, unknown>;
      expect(body.estado_aprobacion).toBeUndefined();
    });

    it("lanza SaldoNegativoError si nuevoTotal < totalPagado", async () => {
      mock.setTableResult("proveedor_facturas", { data: baseActual, error: null });
      mock.setTableResult("pagos_proveedor", {
        data: [{ monto: 500 }, { monto: 300 }],
        error: null,
      });

      await expect(
        actualizarFacturaProveedor("f1", { ...basePayload, subtotal: 100, iva: 0 }),
      ).rejects.toBeInstanceOf(SaldoNegativoError);
    });

    it("tolera 1 centavo de redondeo y NO lanza si está dentro de la tolerancia", async () => {
      mock.setTableResult("proveedor_facturas", { data: baseActual, error: null });
      mock.setTableResult("pagos_proveedor", { data: [{ monto: 1160.005 }], error: null });

      // nuevoTotal = 1160, totalPagado = 1160.005 → diff 0.005 ≤ 0.01 → OK
      await expect(
        actualizarFacturaProveedor("f1", basePayload),
      ).resolves.toBeTruthy();
    });

    it("trimea el folio antes de hacer update", async () => {
      mock.setTableResult("proveedor_facturas", { data: baseActual, error: null });
      mock.setTableResult("pagos_proveedor", { data: [], error: null });

      await actualizarFacturaProveedor("f1", { ...basePayload, folio_proveedor: "  X-99  " });

      const updateCall = mock.tableCalls.find(
        (c) => c.table === "proveedor_facturas" && c.ops.includes("update"),
      );
      const body = updateCall?.opArgs[updateCall.ops.indexOf("update")]?.[0] as Record<string, unknown>;
      expect(body.folio_proveedor).toBe("X-99");
    });

    it("propaga error si la lectura inicial falla", async () => {
      mock.setTableResult("proveedor_facturas", { data: null, error: { message: "rls" } });
      await expect(
        actualizarFacturaProveedor("f1", basePayload),
      ).rejects.toMatchObject({ message: "rls" });
    });

    it("propaga error si la consulta de pagos falla", async () => {
      // Truco: sólo set para pagos_proveedor con error; proveedor_facturas usa default.
      // Pero el default devuelve { data: [], error: null } y .single() devolvería [] como data,
      // lo que rompe .proveedor_id. Por eso seteamos baseActual y luego forzamos error en pagos.
      mock.setTableResult("proveedor_facturas", { data: baseActual, error: null });
      mock.setTableResult("pagos_proveedor", { data: null, error: { message: "pagos-fail" } });
      await expect(
        actualizarFacturaProveedor("f1", basePayload),
      ).rejects.toMatchObject({ message: "pagos-fail" });
    });
  });
});
