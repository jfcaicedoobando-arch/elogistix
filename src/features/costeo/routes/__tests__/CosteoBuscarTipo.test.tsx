/**
 * P1-1 · El "Tipo contenedor" del comparador Top 3 debe permanecer visible
 * tras elegirlo (mouse y teclado) y disparar la consulta con ese id.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const TIPO_HC = { id: "33333333-3333-3333-3333-333333333333", name: "40' High Cube", code: "40HC" };
const TIPO_DRY = { id: "44444444-4444-4444-4444-444444444444", name: "20' Dry", code: "20DV" };

vi.mock("@/features/catalogos/hooks", () => ({
  useTiposContenedor: () => ({ data: [TIPO_DRY, TIPO_HC] }),
}));

vi.mock("@/features/catalogos", () => ({
  PortIdSelect: ({ id, value }: { id: string; value: string }) => (
    <button type="button" id={id} data-value={value}>puerto</button>
  ),
}));

const useTopTarifasMock = vi.fn();
vi.mock("@/features/costeo/hooks/useTopTarifas", () => ({
  useTopTarifas: (...args: unknown[]) => useTopTarifasMock(...args),
}));
vi.mock("@/features/costeo/hooks/useDiagnosticoTarifas", () => ({
  useDiagnosticoTarifas: () => ({ diagnostico: null }),
}));

import CosteoBuscar from "../CosteoBuscar";
import { createWrapper } from "@/test/utils/queryWrapper";

beforeEach(() => {
  useTopTarifasMock.mockReset();
  useTopTarifasMock.mockReturnValue({
    data: [], isFetching: false, tipoContenedorIds: [],
  });
});

describe("CosteoBuscar — tipo de contenedor", () => {
  it("conserva el tipo elegido con mouse y lo envía a la consulta", async () => {
    render(<CosteoBuscar />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByLabelText("Tipo contenedor"));
    const lista = within(await screen.findByRole("listbox"));
    fireEvent.click(lista.getByText("40' High Cube"));

    expect(screen.getByLabelText("Tipo contenedor")).toHaveTextContent("40' High Cube");
    expect(useTopTarifasMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ tipoContenedorId: TIPO_HC.id }),
    );
  });
});
