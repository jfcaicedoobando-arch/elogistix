import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/crm/oportunidadFormHelpers", () => ({
  buildFromOportunidad: vi.fn((op) => ({ ...op, vendedor_id: null })),
  buildEmptyForNueva: vi.fn(() => ({ nombre: "", cliente_id: null, etapa_id: "" })),
}));

import { useOportunidadForm } from "../useOportunidadForm";
import { buildFromOportunidad, buildEmptyForNueva } from "@/lib/crm/oportunidadFormHelpers";

const mockBuildFromOportunidad = vi.mocked(buildFromOportunidad);
const mockBuildEmptyForNueva = vi.mocked(buildEmptyForNueva);

describe("useOportunidadForm", () => {
  it("cuando hay oportunidad, usa buildFromOportunidad", () => {
    const op = { id: "o1", nombre: "Proyecto X" } as never;
    const { result } = renderHook(() => useOportunidadForm(true, op, [], null));
    expect(mockBuildFromOportunidad).toHaveBeenCalledWith(op);
    expect(result.current.form).toMatchObject({ nombre: "Proyecto X" });
  });

  it("cuando open=true y oportunidad=null, usa buildEmptyForNueva", () => {
    const { result } = renderHook(() => useOportunidadForm(true, null, [], null));
    expect(mockBuildEmptyForNueva).toHaveBeenCalled();
    expect(result.current.form).toMatchObject({ nombre: "" });
  });

  it("set() actualiza campo específico", () => {
    const { result } = renderHook(() => useOportunidadForm(true, null, [], null));
    act(() => { result.current.set("nombre", "Nuevo Proyecto"); });
    expect(result.current.form.nombre).toBe("Nuevo Proyecto");
  });
});
