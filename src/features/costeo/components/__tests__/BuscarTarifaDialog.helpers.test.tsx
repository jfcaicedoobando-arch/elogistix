import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFiltrosTarifa } from "../BuscarTarifaDialog.helpers";

const precarga = {
  puertoOrigenId: "shanghai",
  puertoDestinoId: "manzanillo",
  tipoContenedorId: "40hc",
};

describe("useFiltrosTarifa", () => {
  it("aplica la precarga tardía si el operador no ha tocado filtros", () => {
    const { result, rerender } = renderHook(
      ({ initial }) => useFiltrosTarifa(true, initial),
      { initialProps: { initial: undefined as typeof precarga | undefined } },
    );
    rerender({ initial: precarga });
    expect(result.current.origen).toBe("shanghai");
    expect(result.current.destino).toBe("manzanillo");
    expect(result.current.tipo).toBe("40hc");
  });

  it("no sobrescribe filtros capturados si la precarga llega tarde", () => {
    const { result, rerender } = renderHook(
      ({ open, initial }) => useFiltrosTarifa(open, initial),
      { initialProps: { open: true, initial: undefined as typeof precarga | undefined } },
    );
    act(() => {
      result.current.setOrigen("ningbo");
      result.current.setDestino("lazaro-cardenas");
    });
    rerender({ open: true, initial: precarga });
    expect(result.current.origen).toBe("ningbo");
    expect(result.current.destino).toBe("lazaro-cardenas");
    expect(result.current.tipo).toBe("");

    rerender({ open: false, initial: precarga });
    rerender({ open: true, initial: precarga });
    expect(result.current.origen).toBe("shanghai");
    expect(result.current.destino).toBe("manzanillo");
    expect(result.current.tipo).toBe("40hc");
  });
});
