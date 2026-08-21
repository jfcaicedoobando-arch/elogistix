/**
 * Navegación por pasos del modal de captura de factura de proveedor (v13.712.0).
 */
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  useCapturaFacturaPasos,
  agruparPendientes,
  pasoDePendiente,
  TOTAL_PASOS_CAPTURA,
} from "../useCapturaFacturaPasos";

describe("pasoDePendiente", () => {
  it("manda proveedor, folio, importe y T/C al paso 2", () => {
    expect(pasoDePendiente("Falta el proveedor")).toBe(2);
    expect(pasoDePendiente("Falta el folio del proveedor")).toBe(2);
    expect(pasoDePendiente("Falta el importe de la factura")).toBe(2);
    expect(pasoDePendiente("Falta el tipo de cambio")).toBe(2);
  });

  it("manda el CFDI duplicado al paso 1 y la vinculación al paso 3", () => {
    expect(pasoDePendiente("Este CFDI ya está capturado")).toBe(1);
    expect(pasoDePendiente("Lo vinculado excede el subtotal")).toBe(3);
    expect(pasoDePendiente("Sin costos del embarque vinculados")).toBe(3);
  });
});

describe("agruparPendientes", () => {
  it("agrupa por paso conservando el orden", () => {
    expect(
      agruparPendientes([
        "Este CFDI ya está capturado",
        "Falta el proveedor",
        "Sin costos del embarque vinculados",
      ]),
    ).toEqual({
      documento: ["Este CFDI ya está capturado"],
      datos: ["Falta el proveedor"],
      vinculacion: ["Sin costos del embarque vinculados"],
    });
  });
});

describe("useCapturaFacturaPasos", () => {
  it("arranca siempre en el paso 1 (captura manual y buzón)", () => {
    const { result } = renderHook(() =>
      useCapturaFacturaPasos({ abierto: true, pendientes: [] }),
    );
    expect(result.current.paso).toBe(1);
    expect(result.current.esPrimero).toBe(true);
  });

  it("avanza y regresa sin salir del rango de pasos", () => {
    const { result } = renderHook(() =>
      useCapturaFacturaPasos({ abierto: true, pendientes: [] }),
    );

    act(() => result.current.anterior());
    expect(result.current.paso).toBe(1);
    expect(result.current.esPrimero).toBe(true);

    act(() => result.current.siguiente());
    act(() => result.current.siguiente());
    expect(result.current.paso).toBe(TOTAL_PASOS_CAPTURA);
    expect(result.current.esUltimo).toBe(true);

    act(() => result.current.siguiente());
    expect(result.current.paso).toBe(TOTAL_PASOS_CAPTURA);
  });

  it("expone los pendientes que se resuelven en otros pasos", () => {
    const { result } = renderHook(() =>
      useCapturaFacturaPasos({
        abierto: true,
        pendientes: ["Falta el proveedor", "Este CFDI ya está capturado"],
      }),
    );

    expect(result.current.pendientesDeOtrosPasos).toEqual([
      { paso: 2, texto: "Falta el proveedor" },
    ]);

    act(() => result.current.irA(2));
    expect(result.current.pendientesDeOtrosPasos).toEqual([
      { paso: 1, texto: "Este CFDI ya está capturado" },
    ]);
  });
});
