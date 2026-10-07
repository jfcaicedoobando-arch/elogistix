/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mutate, validarLimite } = vi.hoisted(() => ({ mutate: vi.fn(), validarLimite: vi.fn() }));
vi.mock("@/hooks/shared/useOrgActiva", () => ({ useOrgActiva: () => ({ organizationId: "org-1" }) }));
vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("@/features/facturacion/hooks/useCrearFacturaManual", () => ({ useCrearFacturaManual: () => ({ mutate, isPending: false }) }));
vi.mock("@/features/cliente/hooks/useValidarLimiteCredito", () => ({
  useValidarLimiteCredito: () => validarLimite, registrarExcesoCredito: vi.fn(),
}));
vi.mock("@/features/facturacion/hooks/useClientesFiscalOpts", () => ({
  useClientesFiscalOpts: () => ({ data: [{ id: "cliente-1", nombre: "Cliente", rfc: "AAA010101AAA", codigo_postal: "06000", regimen_fiscal: "601", dias_credito: 0 }] }),
}));

import { useFacturaManualForm } from "../useFacturaManualForm";

function formularioValido() {
  const hook = renderHook(() => useFacturaManualForm(true));
  act(() => {
    hook.result.current.onClienteChange("cliente-1");
    hook.result.current.setConceptos([{ descripcion: "Servicio", cantidad: 1, precio_unitario: 1, clave_sat: "78101800", tipo_iva: "gravado_16" }]);
  });
  return hook;
}

beforeEach(() => vi.clearAllMocks());

describe("AUD51: prevalidación forma/método de factura manual", () => {
  it("PPD/99 es válido; cambiar a PUE exige elegir una forma real", async () => {
    const { result } = formularioValido();
    expect(result.current.puedeTimbrar).toBe(true);
    act(() => result.current.updateFiscal({ metodoPago: "PUE" }));

    expect(result.current.fiscal.formaPago).toBe("");
    expect(result.current.puedeTimbrar).toBe(false);
    expect(result.current.puedeGuardar).toBe(true);
    expect(result.current.faltantesTimbrar).toContain("forma y método de pago compatibles");
    await act(() => result.current.handleSubmit(true));
    expect(validarLimite).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();

    act(() => result.current.updateFiscal({ formaPago: "03" }));
    expect(result.current.puedeTimbrar).toBe(true);
    await act(() => result.current.handleSubmit(true));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ metodoPago: "PUE", formaPago: "03" }), timbrarAlGuardar: true,
    }), expect.any(Object));
  });

  it("rechaza PUE/99 aun si llega un valor inválido al estado", async () => {
    const { result } = formularioValido();
    act(() => result.current.updateFiscal({ metodoPago: "PUE" }));
    act(() => result.current.updateFiscal({ formaPago: "99" }));

    expect(result.current.puedeTimbrar).toBe(false);
    await act(() => result.current.handleSubmit(true));
    expect(mutate).not.toHaveBeenCalled();
    expect(validarLimite).not.toHaveBeenCalled();
  });

  it("al cambiar PUE/03 a PPD fija 99 y al volver no reutiliza una forma obsoleta", () => {
    const { result } = formularioValido();
    act(() => result.current.updateFiscal({ metodoPago: "PUE", formaPago: "03" }));
    expect(result.current.puedeTimbrar).toBe(true);
    act(() => result.current.updateFiscal({ metodoPago: "PPD" }));
    expect(result.current.fiscal.formaPago).toBe("99");
    expect(result.current.puedeTimbrar).toBe(true);
    act(() => result.current.updateFiscal({ metodoPago: "PUE" }));
    expect(result.current.fiscal.formaPago).toBe("");
    expect(result.current.puedeTimbrar).toBe(false);
  });
});
