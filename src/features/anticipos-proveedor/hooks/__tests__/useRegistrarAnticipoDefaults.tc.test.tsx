/**
 * MNY P2.7 — al registrar un anticipo con fecha retroactiva se sugiere el DOF de
 * ESA fecha (antes se persistía el DOF más reciente). Un T/C escrito a mano se
 * conserva al cambiar la fecha.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const tcMock = vi.fn();
vi.mock("@/features/catalogos/hooks", () => ({
  useTcDofPorFecha: (fecha: string | null, enabled?: boolean) => tcMock(fecha, enabled),
}));

vi.mock("@/features/tesoreria/hooks", () => ({
  useCuentasBancarias: () => ({ data: [{ id: "c1", alias: "USD", banco: "BBVA", moneda: "USD" }] }),
}));

import { useRegistrarAnticipoDefaults } from "../useRegistrarAnticipoDefaults";

function montar(fecha: string, valorActual: number | undefined, setValue = vi.fn()) {
  const r = renderHook(
    (p: { fecha: string; tc: number | undefined }) =>
      useRegistrarAnticipoDefaults({
        open: true,
        moneda: "USD",
        fechaAnticipo: p.fecha,
        cuentaBancariaId: undefined,
        requiereCuenta: true,
        tipoCambioUsd: p.tc,
        onProveedorFijo: () => {},
        setValue,
      } as never),
    { initialProps: { fecha, tc: valorActual } },
  );
  return { ...r, setValue };
}

describe("useRegistrarAnticipoDefaults · T/C por fecha del anticipo", () => {
  beforeEach(() => {
    tcMock.mockReset();
    tcMock.mockReturnValue({ data: { usdMxn: 17.1, eurMxn: 19, fecha: "2026-08-01", exacto: true } });
  });

  it("pide el DOF de la fecha capturada, no el más reciente", () => {
    montar("2026-08-01", undefined);
    expect(tcMock).toHaveBeenCalledWith("2026-08-01", true);
  });

  it("sugiere el T/C de esa fecha y lo dice en el hint", () => {
    const { result, setValue } = montar("2026-08-01", undefined);
    expect(setValue).toHaveBeenCalledWith("tipoCambioUsd", 17.1, expect.anything());
    expect(result.current.tcHint).toMatch(/DOF del 2026-08-01/);
  });

  it("re-sugiere al cambiar la fecha si el valor venía de la sugerencia", () => {
    const setValue = vi.fn();
    const { rerender } = montar("2026-08-01", undefined, setValue);
    tcMock.mockReturnValue({ data: { usdMxn: 18.4, eurMxn: 20, fecha: "2026-09-01", exacto: true } });
    act(() => rerender({ fecha: "2026-09-01", tc: 17.1 }));
    expect(setValue).toHaveBeenLastCalledWith("tipoCambioUsd", 18.4, expect.anything());
  });

  it("conserva un T/C escrito a mano y lo señala en el hint", () => {
    const setValue = vi.fn();
    const { result, rerender } = montar("2026-08-01", 16.5, setValue);
    tcMock.mockReturnValue({ data: { usdMxn: 18.4, eurMxn: 20, fecha: "2026-09-01", exacto: true } });
    act(() => rerender({ fecha: "2026-09-01", tc: 16.5 }));
    expect(setValue).not.toHaveBeenCalledWith("tipoCambioUsd", 18.4, expect.anything());
    expect(result.current.tcHint).toMatch(/capturado por ti/);
  });

  it("sin DOF publicado invita a capturarlo a mano", () => {
    tcMock.mockReturnValue({ data: null });
    const { result } = montar("2026-08-01", undefined);
    expect(result.current.tcHint).toMatch(/Sin tipo de cambio DOF/);
  });
});
