/**
 * Etapa 5 · estado de puertos en la solicitud de cotización del portal.
 */
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSolicitudCotizacionForm } from "../useSolicitudCotizacionForm";

function render() {
  return renderHook(() => useSolicitudCotizacionForm("cli-1"));
}

describe("useSolicitudCotizacionForm · puertos", () => {
  it("arranca sin IDs de puerto", () => {
    const { result } = render();
    expect(result.current.puertoOrigenId).toBeNull();
    expect(result.current.puertoDestinoId).toBeNull();
  });

  it("guarda texto + ID cuando se elige del catálogo", () => {
    const { result } = render();
    act(() => result.current.setModo("Marítimo"));
    act(() => result.current.setOrigen("Valencia, España (ESVLC)", "p-1"));
    expect(result.current.origen).toBe("Valencia, España (ESVLC)");
    expect(result.current.puertoOrigenId).toBe("p-1");
  });

  it("deja el ID en null con texto libre", () => {
    const { result } = render();
    act(() => result.current.setDestino("Puerto sin catálogo"));
    expect(result.current.destino).toBe("Puerto sin catálogo");
    expect(result.current.puertoDestinoId).toBeNull();
  });

  it("no permite el mismo ID en ambos extremos", () => {
    const { result } = render();
    act(() => result.current.setOrigen("A", "p-1"));
    act(() => result.current.setDestino("B", "p-1"));
    expect(result.current.puertoDestinoId).toBe("p-1");
    expect(result.current.puertoOrigenId).toBeNull();
    expect(result.current.origen).toBe("A");
  });

  it("al salir de Marítimo conserva textos y limpia IDs", () => {
    const { result } = render();
    act(() => result.current.setModo("Marítimo"));
    act(() => result.current.setOrigen("A", "p-1"));
    act(() => result.current.setDestino("B", "p-2"));
    act(() => result.current.setModo("Aéreo"));
    expect(result.current.origen).toBe("A");
    expect(result.current.destino).toBe("B");
    expect(result.current.puertoOrigenId).toBeNull();
    expect(result.current.puertoDestinoId).toBeNull();
  });

  it("reset limpia ambos IDs", () => {
    const { result } = render();
    act(() => result.current.setOrigen("A", "p-1"));
    act(() => result.current.reset());
    expect(result.current.puertoOrigenId).toBeNull();
    expect(result.current.puertoDestinoId).toBeNull();
  });
});
