import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/features/crm/domain/oportunidadFormHelpers", () => ({
  buildFromOportunidad: vi.fn((op) => ({ ...op, vendedor_id: null })),
  buildEmptyForNueva: vi.fn(() => ({ nombre: "", cliente_id: null, etapa_id: "" })),
  primeraEtapaAbierta: vi.fn(() => null),
}));

import { useOportunidadForm } from "../useOportunidadForm";
import { buildFromOportunidad, buildEmptyForNueva } from "@/features/crm/domain/oportunidadFormHelpers";

const mockBuildFromOportunidad = vi.mocked(buildFromOportunidad);
const mockBuildEmptyForNueva = vi.mocked(buildEmptyForNueva);

// Referencias estables para los argumentos del hook. Sin esto, cada render
// crea un nuevo `[]` / `null` literal en la fábrica del renderHook, lo que
// dispara el useEffect interno indefinidamente y provoca un bucle de renders
// que termina en OOM (~8GB) durante la suite de Vitest (shard 9/10).
const STABLE_ETAPAS: never[] = [];
const STABLE_USER = null;

describe("useOportunidadForm", () => {
  it("cuando hay oportunidad, usa buildFromOportunidad", () => {
    const op = { id: "o1", nombre: "Proyecto X" } as never;
    const { result } = renderHook(() =>
      useOportunidadForm(true, op, STABLE_ETAPAS, STABLE_USER),
    );
    expect(mockBuildFromOportunidad).toHaveBeenCalledWith(op);
    expect(result.current.form).toMatchObject({ nombre: "Proyecto X" });
  });

  it("cuando open=true y oportunidad=null, usa buildEmptyForNueva", () => {
    const { result } = renderHook(() =>
      useOportunidadForm(true, null, STABLE_ETAPAS, STABLE_USER),
    );
    expect(mockBuildEmptyForNueva).toHaveBeenCalled();
    expect(result.current.form).toMatchObject({ nombre: "" });
  });

  it("set() actualiza campo específico", () => {
    const { result } = renderHook(() =>
      useOportunidadForm(true, null, STABLE_ETAPAS, STABLE_USER),
    );
    act(() => {
      result.current.set("nombre", "Nuevo Proyecto");
    });
    expect(result.current.form.nombre).toBe("Nuevo Proyecto");
  });

  it("prefija la etapa de la columna del Kanban cuando es abierta", () => {
    const etapas = [
      { id: "e1", probabilidad_default: 20, tipo: "abierta" },
      { id: "e2", probabilidad_default: 60, tipo: "abierta" },
    ];
    const { result } = renderHook(() =>
      useOportunidadForm(true, null, etapas, STABLE_USER, { etapaId: "e2" }),
    );
    expect(result.current.form).toMatchObject({ etapa_id: "e2", probabilidad: 60 });
  });

  it("ignora la etapa prefijada si es terminal (ganada/perdida)", () => {
    const etapas = [
      { id: "e-gan", probabilidad_default: 100, tipo: "ganada" },
      { id: "e1", probabilidad_default: 20, tipo: "abierta" },
    ];
    const { result } = renderHook(() =>
      useOportunidadForm(true, null, etapas, STABLE_USER, { etapaId: "e-gan" }),
    );
    // No se prefija la terminal; el mock de buildEmptyForNueva deja etapa "".
    expect(result.current.form.etapa_id).toBe("");
  });
});
