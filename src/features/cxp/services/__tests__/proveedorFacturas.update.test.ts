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
import { detectarCambioSensible } from "../proveedorFacturas.update.reglas";

const baseActual = {
  id: "f1",
  proveedor_id: "p1",
  estado_aprobacion: "aprobada",
  folio_proveedor: "A-1",
  fecha_emision: "2026-01-01",
  moneda: "MXN" as const,
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
    mock.setTableResult("v_proveedor_facturas_saldo", {
      data: [{ proveedor_factura_id: "f1", pagado: 0, notas_credito_aplicadas: 0, saldo: 1160 }], error: null,
    });
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
    it.each([20.0001, 20.0049, 20.01])("TC 20 a %s exige nueva aprobación", async (tc) => {
      const actual = { ...baseActual, moneda: "USD", tipo_cambio_usd: 20 };
      mock.setTableResult("proveedor_facturas", { data: actual, error: null });
      mock.setTableResult("pagos_proveedor", { data: [], error: null });
      await actualizarFacturaProveedor("f1", { ...basePayload, moneda: "USD", tipo_cambio_usd: tc });
      const update = mock.tableCalls.find((c) => c.table === "proveedor_facturas" && c.ops.includes("update"))!;
      expect(update.opArgs[update.ops.indexOf("update")]?.[0]).toMatchObject({ estado_aprobacion: "pendiente", aprobada_por: null, aprobada_at: null });
    });
    it("compara importes a centavos y tipo de cambio a cuatro decimales", () => {
      expect(detectarCambioSensible(baseActual, { ...basePayload, subtotal: 1000.001 })).toBe(false);
      expect(detectarCambioSensible(baseActual, { ...basePayload, subtotal: 1000.01 })).toBe(true);
      expect(detectarCambioSensible(baseActual, { ...basePayload, tipo_cambio_usd: 1.0001 })).toBe(true);
      expect(detectarCambioSensible(baseActual, { ...basePayload, tipo_cambio_usd: 1.00004 })).toBe(false);
    });
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
      mock.setTableResult("v_proveedor_facturas_saldo", {
        data: [{ proveedor_factura_id: "f1", pagado: 800, notas_credito_aplicadas: 0, saldo: 360 }],
        error: null,
      });

      await expect(
        actualizarFacturaProveedor("f1", { ...basePayload, subtotal: 100, iva: 0 }),
      ).rejects.toBeInstanceOf(SaldoNegativoError);
    });

    it("tolera 1 centavo de redondeo y NO lanza si está dentro de la tolerancia", async () => {
      mock.setTableResult("proveedor_facturas", { data: baseActual, error: null });
      mock.setTableResult("v_proveedor_facturas_saldo", {
        data: [{ proveedor_factura_id: "f1", pagado: 1160.005, notas_credito_aplicadas: 0, saldo: -0.005 }], error: null,
      });

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
      mock.setTableResult("v_proveedor_facturas_saldo", { data: null, error: { message: "pagos-fail" } });
      await expect(
        actualizarFacturaProveedor("f1", basePayload),
      ).rejects.toMatchObject({ message: "pagos-fail" });
    });
    it("55: permite editar notas de USD116 con NC MXN2000 aplicada como USD100", async () => {
      mock.setTableResult("proveedor_facturas", { data: { ...baseActual, moneda: "USD", tipo_cambio_usd: 20, subtotal: 116, iva: 0 }, error: null });
      mock.setTableResult("proveedor_notas_credito", { data: [{ monto: 2000, moneda: "MXN", tipo_cambio: 20, estado: "Aplicada" }], error: null });
      mock.setTableResult("v_proveedor_facturas_saldo", {
        data: [{ proveedor_factura_id: "f1", pagado: 0, notas_credito_aplicadas: 100, saldo: 16 }], error: null,
      });
      await expect(actualizarFacturaProveedor("f1", {
        ...basePayload, moneda: "USD", tipo_cambio_usd: 20, subtotal: 116, iva: 0, notas: "Solo notas",
      })).resolves.toBeTruthy();
      expect(mock.getMutationPayload("proveedor_facturas", "update")).toMatchObject({ total: 116, notas: "Solo notas" });
      expect(mock.tableCalls.some((c) => c.table === "proveedor_notas_credito" || c.table === "pagos_proveedor")).toBe(false);
    });

    it("55: sigue rechazando un total menor a pagos más NC convertidos", async () => {
      mock.setTableResult("proveedor_facturas", { data: baseActual, error: null });
      mock.setTableResult("v_proveedor_facturas_saldo", {
        data: [{ proveedor_factura_id: "f1", pagado: 60, notas_credito_aplicadas: 100, saldo: 1000 }], error: null,
      });
      await expect(actualizarFacturaProveedor("f1", { ...basePayload, subtotal: 100, iva: 0 })).rejects.toMatchObject({ code: "SALDO_NEGATIVO", totalPagado: 160 });
      expect(mock.getMutationPayload("proveedor_facturas", "update")).toBeNull();
    });

    it("55: sin saldo canónico no inventa saldo cero ni guarda", async () => {
      mock.setTableResult("proveedor_facturas", { data: baseActual, error: null });
      mock.setTableResult("v_proveedor_facturas_saldo", { data: [], error: null });
      await expect(actualizarFacturaProveedor("f1", basePayload)).rejects.toThrow("No se pudo verificar el saldo");
      expect(mock.getMutationPayload("proveedor_facturas", "update")).toBeNull();
    });

    it("55: permite cambiar moneda sin aplicaciones y mantiene la validación canónica", async () => {
      mock.setTableResult("proveedor_facturas", { data: baseActual, error: null });
      await expect(actualizarFacturaProveedor("f1", { ...basePayload, moneda: "USD", tipo_cambio_usd: 20 })).resolves.toBeTruthy();
      expect(mock.tableCalls.some((c) => c.table === "v_proveedor_facturas_saldo")).toBe(true);
    });
    it("55: USD116 a MXN116 con NC MXN2000 se bloquea aunque el total nominal no cambie", async () => {
      mock.setTableResult("proveedor_facturas", { data: { ...baseActual, moneda: "USD", tipo_cambio_usd: 20, subtotal: 116, iva: 0 }, error: null });
      mock.setTableResult("proveedor_notas_credito", { data: [{ id: "nc1", monto: 2000, moneda: "MXN", tipo_cambio: 20 }], error: null });
      mock.setTableResult("v_proveedor_facturas_saldo", { data: [{ proveedor_factura_id: "f1", pagado: 0, notas_credito_aplicadas: 100, saldo: 16 }], error: null });
      await expect(actualizarFacturaProveedor("f1", { ...basePayload, subtotal: 116, iva: 0 }))
        .rejects.toMatchObject({ code: "CAMBIO_MONEDA_CON_APLICACIONES" });
      expect(mock.getMutationPayload("proveedor_facturas", "update")).toBeNull();
      const call = mock.tableCalls.find((c) => c.table === "proveedor_notas_credito")!;
      expect(call.opArgs).toContainEqual(["estado", "Aplicada"]);
      expect(call.opArgs).toContainEqual(["deleted_at", null]);
    });
    it("55: un pago activo bloquea el cambio de moneda sin alterar su aplicación", async () => {
      mock.setTableResult("proveedor_facturas", { data: baseActual, error: null });
      mock.setTableResult("pagos_proveedor", { data: [{ id: "p1", monto: 20 }], error: null });
      await expect(actualizarFacturaProveedor("f1", { ...basePayload, moneda: "USD", tipo_cambio_usd: 20 }))
        .rejects.toMatchObject({ code: "CAMBIO_MONEDA_CON_APLICACIONES" });
      expect(mock.getMutationPayload("proveedor_facturas", "update")).toBeNull();
    });
    it("55: un cambio de TC nunca omite el guard de pagos y NC canónicos", async () => {
      mock.setTableResult("proveedor_facturas", { data: baseActual, error: null });
      mock.setTableResult("v_proveedor_facturas_saldo", { data: [{ proveedor_factura_id: "f1", pagado: 80, notas_credito_aplicadas: 100, saldo: 980 }], error: null });
      await expect(actualizarFacturaProveedor("f1", { ...basePayload, subtotal: 116, iva: 0, tipo_cambio_usd: 21 }))
        .rejects.toMatchObject({ code: "SALDO_NEGATIVO", totalPagado: 180 });
      expect(mock.getMutationPayload("proveedor_facturas", "update")).toBeNull();
    });
    it("55: conserva el rechazo transaccional de DB cuando cambia moneda", async () => {
      mock.setTableResultOnce("proveedor_facturas", { data: baseActual, error: null });
      mock.setTableResultOnce("proveedor_facturas", { data: [], error: null });
      mock.setTableResultOnce("proveedor_facturas", { data: null, error: { message: "saldo negativo de DB", code: "P0001" } });
      await expect(actualizarFacturaProveedor("f1", { ...basePayload, moneda: "USD", tipo_cambio_usd: 20 }))
        .rejects.toMatchObject({ message: "saldo negativo de DB", code: "P0001" });
    });
  });
});
