/**
 * MNY P2.6 — la sugerencia de monto no debe borrar la captura del usuario
 * cuando llega tarde el DOF o cambia la fecha de aplicación; el exceso se avisa.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const tcMock = vi.fn();
vi.mock("@/features/catalogos/hooks", () => ({
  useTcDofPorFecha: () => tcMock(),
}));

vi.mock("@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations", () => ({
  useAplicarAnticipo: () => ({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false }),
}));

import { useAplicarAnticipoDesdeFactura } from "../useAplicarAnticipoDesdeFactura";

const anticipos = [
  {
    id: "a1",
    moneda: "USD",
    disponible: 500,
    aplicado: 0,
    monto: 500,
    estado: "vigente",
    embarque_id: null,
    embarque_expediente: null,
  },
] as never;

function montar() {
  return renderHook(() =>
    useAplicarAnticipoDesdeFactura({
      open: true,
      onOpenChange: () => {},
      facturaId: "f1",
      saldoFactura: 3600,
      monedaFactura: "MXN",
      anticipos,
    }),
  );
}

describe("useAplicarAnticipoDesdeFactura · monto capturado", () => {
  beforeEach(() => {
    tcMock.mockReturnValue({
      data: { usdMxn: 18, eurMxn: 20.7692, fecha: "2026-09-16", exacto: true },
    });
  });

  it("sugiere el tope convertido una sola vez al seleccionar el anticipo", () => {
    const { result } = montar();
    expect(result.current.anticipoId).toBe("a1");
    // 3600 MXN / 18 = 200 USD; el disponible (500) es mayor.
    expect(result.current.monto).toBe("200.00");
  });

  it("conserva el monto capturado cuando cambia la fecha (nuevo tope)", () => {
    const { result, rerender } = montar();
    act(() => result.current.setMonto("150"));
    tcMock.mockReturnValue({
      data: { usdMxn: 20, eurMxn: 21, fecha: "2026-09-10", exacto: true },
    });
    act(() => result.current.setFecha("2026-09-10"));
    rerender();
    expect(result.current.monto).toBe("150");
    expect(result.current.excedeTope).toBe(false);
  });

  it("avisa el exceso en vez de borrar la captura", () => {
    const { result } = montar();
    act(() => result.current.setMonto("400"));
    expect(result.current.monto).toBe("400");
    expect(result.current.excedeTope).toBe(true);
  });

  it("sin paridad DOF no sugiere monto ni inventa tope", () => {
    tcMock.mockReturnValue({ data: null });
    const { result } = montar();
    expect(result.current.tope.tope).toBeNull();
    expect(result.current.monto).toBe("0");
  });
});
