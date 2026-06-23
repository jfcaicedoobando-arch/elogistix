import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermissions } from "@/hooks/shared";

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/lib/contexts/AuthContext";
const mockUseAuth = vi.mocked(useAuth);

describe("usePermissions", () => {
  it("admin → canEdit true, isAdmin true", () => {
    mockUseAuth.mockReturnValue({ role: "admin", effectiveRole: "admin" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEdit).toBe(true);
    expect(result.current.isAdmin).toBe(true);
  });

  it("operador → canEdit true, isAdmin false", () => {
    mockUseAuth.mockReturnValue({ role: "operador", effectiveRole: "operador" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEdit).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it("viewer → canEdit false, isAdmin false", () => {
    mockUseAuth.mockReturnValue({ role: "viewer", effectiveRole: "viewer" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEdit).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it("gerente_operaciones → canCotizarSinDesglose true", () => {
    mockUseAuth.mockReturnValue({ role: "gerente_operaciones", effectiveRole: "gerente_operaciones" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canCotizarSinDesglose).toBe(true);
  });

  it("vendedor → canCotizarSinDesglose false", () => {
    mockUseAuth.mockReturnValue({ role: "vendedor", effectiveRole: "vendedor" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canCotizarSinDesglose).toBe(false);
  });

  // v13.118.0 — Vendedor arma cotizaciones con P&L preliminar y hace handoff.
  it("vendedor → canEditOperations, canViewFinancials y canHandoffCotizacion true", () => {
    mockUseAuth.mockReturnValue({ role: "vendedor", effectiveRole: "vendedor" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEditOperations).toBe(true);
    expect(result.current.canViewFinancials).toBe(true);
    expect(result.current.canHandoffCotizacion).toBe(true);
  });

  // v13.118.0 — Pricing trabaja Costeo y negocia tarifas; sigue viendo finanzas.
  it("ejecutivo_pricing → canEditOperations y canViewFinancials true; NO handoff", () => {
    mockUseAuth.mockReturnValue({ role: "ejecutivo_pricing", effectiveRole: "ejecutivo_pricing" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEditOperations).toBe(true);
    expect(result.current.canViewFinancials).toBe(true);
    expect(result.current.canHandoffCotizacion).toBe(false);
  });

  // v13.54.0 — Bloque Q: separación de responsabilidades financieras
  it("contador → emite, captura y cobra; NO paga proveedor", () => {
    mockUseAuth.mockReturnValue({ role: "contador", effectiveRole: "contador" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEmitirFactura).toBe(true);
    expect(result.current.canCapturarFacturaProveedor).toBe(true);
    expect(result.current.canRegistrarCobro).toBe(true);
    expect(result.current.canPagarProveedor).toBe(false);
  });

  it("auxiliar_contable → sólo captura factura de proveedor", () => {
    mockUseAuth.mockReturnValue({ role: "auxiliar_contable", effectiveRole: "auxiliar_contable" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canCapturarFacturaProveedor).toBe(true);
    expect(result.current.canEmitirFactura).toBe(false);
    expect(result.current.canPagarProveedor).toBe(false);
    expect(result.current.canRegistrarCobro).toBe(false);
  });

  it("tesorero → sólo paga proveedores", () => {
    mockUseAuth.mockReturnValue({ role: "tesorero", effectiveRole: "tesorero" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canPagarProveedor).toBe(true);
    expect(result.current.canEmitirFactura).toBe(false);
    expect(result.current.canCapturarFacturaProveedor).toBe(false);
    expect(result.current.canRegistrarCobro).toBe(false);
  });

  it("ejecutivo_cobranza → sólo registra cobros", () => {
    mockUseAuth.mockReturnValue({ role: "ejecutivo_cobranza", effectiveRole: "ejecutivo_cobranza" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canRegistrarCobro).toBe(true);
    expect(result.current.canEmitirFactura).toBe(false);
    expect(result.current.canCapturarFacturaProveedor).toBe(false);
    expect(result.current.canPagarProveedor).toBe(false);
  });

  it("operador → ninguna capacidad financiera de acción", () => {
    mockUseAuth.mockReturnValue({ role: "operador", effectiveRole: "operador" } as Partial<ReturnType<typeof useAuth>> as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canEmitirFactura).toBe(false);
    expect(result.current.canCapturarFacturaProveedor).toBe(false);
    expect(result.current.canPagarProveedor).toBe(false);
    expect(result.current.canRegistrarCobro).toBe(false);
  });

});
