/**
 * Tests del controller hook `useNuevaFacturaProveedorForm`.
 * Cubre: cambios de campos, recálculo de vencimiento, total, validación,
 * handler de proveedor (limpia vínculos), toggleVinculo, submit happy,
 * submit con error duplicado UUID, y handleCfdiParsed con proveedor desconocido.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const mutateAsync = vi.fn();
const findProveedor = vi.fn();
const subirArchivos = vi.fn();
const vincular = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastWarning = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    warning: (...a: unknown[]) => toastWarning(...a),
  },
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1" } }),
}));
vi.mock("@/hooks/shared", () => ({
  useOrgFilter: () => ({ organizationId: "org-1" }),
}));
vi.mock("@/features/proveedor/services", () => ({
  findProveedorByRfcEnOrg: (...a: unknown[]) => findProveedor(...a),
}));
vi.mock("@/features/cxp/services", () => ({
  subirArchivosCfdiFactura: (...a: unknown[]) => subirArchivos(...a),
  vincularFacturaAConceptos: (...a: unknown[]) => vincular(...a),
  existeFacturaDuplicada: vi.fn().mockResolvedValue(false),
  validarCuadreCfdi: vi.fn().mockReturnValue({ ok: true, errores: [] }),
}));
vi.mock("@/features/cxp/hooks", () => ({
  useCrearFacturaProveedor: () => ({ mutateAsync, isPending: false }),
}));

import { useNuevaFacturaProveedorForm } from "../useNuevaFacturaProveedorForm";

beforeEach(() => {
  vi.clearAllMocks();
  mutateAsync.mockResolvedValue({ id: "fact-1" });
  subirArchivos.mockResolvedValue(undefined);
  vincular.mockResolvedValue({ liquidados: [] });
});

describe("useNuevaFacturaProveedorForm", () => {
  it("handleChange recalcula vencimiento al cambiar diasCredito", () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useNuevaFacturaProveedorForm(onDone), { wrapper: createWrapper() });
    act(() => result.current.handleChange("emision", "2026-01-01"));
    act(() => result.current.handleChange("diasCredito", 15));
    expect(result.current.values.vencimiento).toBe("2026-01-16");
  });

  it("total = subtotal + iva − retenciones", () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useNuevaFacturaProveedorForm(onDone), { wrapper: createWrapper() });
    act(() => {
      result.current.handleChange("subtotal", "1000");
      result.current.handleChange("iva", "160");
      result.current.handleChange("retenciones", "100");
    });
    expect(result.current.total).toBe(1060);
  });

  it("handleProveedor limpia los vínculos previos", () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useNuevaFacturaProveedorForm(onDone), { wrapper: createWrapper() });
    act(() => result.current.toggleVinculo(
      { id: "c1", embarque_id: "e1", concepto: "Flete", monto: 500 } as never,
      true,
    ));
    expect(Object.keys(result.current.vinculos)).toEqual(["c1"]);
    act(() => result.current.handleProveedor("p1", "Nuevo Prov"));
    expect(result.current.values.provId).toBe("p1");
    expect(result.current.vinculos).toEqual({});
  });

  // v13.315.8 (QW2) — al seleccionar proveedor con dias_credito, se hereda al form.
  it("handleProveedor hereda dias_credito del proveedor y recalcula vencimiento", () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useNuevaFacturaProveedorForm(onDone), { wrapper: createWrapper() });
    const emisionInicial = result.current.values.emision;
    act(() => result.current.handleProveedor("p1", "ACME 15", 15));
    expect(result.current.values.diasCredito).toBe(15);
    // vencimiento = emision + 15 días
    const [y, m, d] = emisionInicial.split("-").map(Number);
    const esperado = new Date(Date.UTC(y, m - 1, d));
    esperado.setUTCDate(esperado.getUTCDate() + 15);
    const iso = esperado.toISOString().slice(0, 10);
    expect(result.current.values.vencimiento).toBe(iso);
  });

  it("handleProveedor sin dias_credito conserva el valor previo del form", () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useNuevaFacturaProveedorForm(onDone), { wrapper: createWrapper() });
    // El default de initialValues es 30; seleccionamos proveedor SIN dias_credito.
    act(() => result.current.handleProveedor("p2", "Contado", 0));
    expect(result.current.values.diasCredito).toBe(30);
  });


  it("submit con validación fallida no llama mutateAsync y muestra toast", async () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useNuevaFacturaProveedorForm(onDone), { wrapper: createWrapper() });
    await act(async () => { await result.current.submit(); });
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Revisa los campos marcados", expect.anything());
    expect(result.current.errors.provId).toMatch(/proveedor/i);
  });

  it("submit happy path llama mutateAsync con payload correcto y resetea", async () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useNuevaFacturaProveedorForm(onDone), { wrapper: createWrapper() });
    act(() => {
      result.current.handleProveedor("p1", "ACME");
      result.current.handleChange("folio", "F-001");
      result.current.handleChange("subtotal", "1000");
      result.current.handleChange("iva", "160");
      result.current.handleChange("categoriaId", "cat-1");
    });
    await act(async () => { await result.current.submit(); });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    const payload = mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      proveedor_id: "p1", folio_proveedor: "F-001",
      subtotal: 1000, iva: 160, total: 1160, created_by: "u-1",
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.values.folio).toBe("");
  });

  it("submit con error UUID duplicado muestra mensaje específico", async () => {
    mutateAsync.mockRejectedValueOnce({ code: "23505", message: "uuid_fiscal dup" });
    const onDone = vi.fn();
    const { result } = renderHook(() => useNuevaFacturaProveedorForm(onDone), { wrapper: createWrapper() });
    act(() => {
      result.current.handleProveedor("p1", "ACME");
      result.current.handleChange("folio", "F-1");
      result.current.handleChange("subtotal", "100");
      result.current.handleChange("categoriaId", "cat-1");
    });
    await act(async () => { await result.current.submit(); });
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/UUID fiscal/i), expect.anything());
    expect(onDone).not.toHaveBeenCalled();
  });

  it("handleCfdiParsed sin proveedor encontrado dispara askCrearProv", async () => {
    findProveedor.mockResolvedValueOnce(null);
    const onDone = vi.fn();
    const { result } = renderHook(() => useNuevaFacturaProveedorForm(onDone), { wrapper: createWrapper() });
    const xml = new File(["<x/>"], "f.xml", { type: "text/xml" });
    await act(async () => {
      await result.current.handleCfdiParsed(
        {
          cfdi: { uuid: "U-1", moneda: "MXN", serie: "A", folio: "100", fecha: "2026-02-01", tipo_cambio: 1, subtotal: 100, iva_trasladado: 16, retenciones: 0, emisor: { rfc: "XAXX010101000", nombre: "Otro SA" } },
          ai: { categoria_id: null, notas: null },
        } as never,
        { xml, pdf: null },
      );
    });
    await waitFor(() => expect(result.current.askCrearProv).toEqual({ rfc: "XAXX010101000", nombre: "Otro SA" }));
    expect(result.current.pendingCfdi?.uuid).toBe("U-1");
    expect(result.current.values.folio).toBe("A-100");
  });
});
