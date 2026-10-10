import { renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useInvalidarTarifaAutomatica } from "../useInvalidarTarifaAutomatica";
import { COTIZACION_FORM_DEFAULTS, type CotizacionFormValues } from "@/features/cotizacion/types";

// Aísla el barrel de UI; la normalización importada sigue siendo la real.
vi.mock("@/features/catalogos", async () => {
  const { claveIdentidadCatalogo } = await import("@/features/catalogos/utils/tiposContenedorCanonico");
  return { claveIdentidadCatalogo };
});

const HC = "11111111-1111-4111-8111-111111111111";
const LEGACY = "22222222-2222-4222-8222-222222222222";
const catalogo = [
  { id: HC, code: "40HC", name: "40' High Cube", idsEquivalentes: [HC, LEGACY] },
  { id: "dry", code: "20DRY", name: "20' Dry", idsEquivalentes: ["dry"] },
];
const { notifyWarning, leerTarifa, leerTipos } = vi.hoisted(() => ({
  notifyWarning: vi.fn(), leerTarifa: vi.fn(), leerTipos: vi.fn(),
}));
vi.mock("@/features/catalogos/hooks", () => ({ useTiposContenedor: () => leerTipos() }));
vi.mock("@/features/cotizacion/hooks/useTarifaVinculada", () => ({ useTarifaVinculada: () => leerTarifa() }));
vi.mock("@/lib/ui/appFeedback.notices", () => ({ notifyWarning }));

function setup(tipoContenedor: string) {
  const setCostos = vi.fn();
  const hook = renderHook(() => {
    const form = useForm<CotizacionFormValues>({ defaultValues: {
      ...COTIZACION_FORM_DEFAULTS, modo: "Marítimo", incoterm: "FOB", tipoEmbarque: "FCL", tarifaId: "t1", tipoContenedor,
    } });
    useInvalidarTarifaAutomatica({ form, setCostosInternos: setCostos });
    return form;
  });
  return { ...hook, setCostos };
}

beforeEach(() => {
  vi.clearAllMocks();
  leerTipos.mockReturnValue({ data: catalogo });
  leerTarifa.mockReturnValue({ data: { tipo_contenedor_id: LEGACY } });
});

describe("GUI69: la invalidación usa la misma identidad de contenedor", () => {
  it.each([HC, LEGACY, "40' High Cube", "40HC"])("mantiene tarifa equivalente a %s", (tipo) => {
    const { result, setCostos } = setup(tipo);
    expect(result.current.getValues("tarifaId")).toBe("t1");
    expect(setCostos).not.toHaveBeenCalled();
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it.each(["dry", "20' Dry", "20DRY"])("desvincula un contenedor realmente diferente: %s", (tipo) => {
    const { result, setCostos } = setup(tipo);
    expect(result.current.getValues("tarifaId")).toBeNull();
    expect(setCostos).toHaveBeenCalledTimes(1);
    expect(notifyWarning).toHaveBeenCalledTimes(1);
    const filas = [{ notas: "Auto-cargado desde tarifa marítima" }, { notas: "Manual" }];
    expect(setCostos.mock.calls[0][0](filas)).toEqual([filas[1]]);
  });

  it("espera el catálogo antes de comparar y conserva el equivalente cuando llega", () => {
    leerTipos.mockReturnValue({ data: [] });
    const { result, rerender } = setup("40' High Cube");
    expect(result.current.getValues("tarifaId")).toBe("t1");
    leerTipos.mockReturnValue({ data: catalogo });
    rerender();
    expect(result.current.getValues("tarifaId")).toBe("t1");
  });
});
