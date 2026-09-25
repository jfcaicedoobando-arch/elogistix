/**
 * P1-1 · El "Tipo contenedor" del comparador Top 3 debe permanecer visible
 * tras elegirlo (mouse y teclado) y disparar la consulta con ese id.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const LEGACY_HC = "99999999-9999-9999-9999-999999999999";
const TIPO_HC = {
  id: "33333333-3333-3333-3333-333333333333", name: "40' High Cube", code: "40HC",
  idsEquivalentes: ["33333333-3333-3333-3333-333333333333", LEGACY_HC],
};
const TIPO_DRY = {
  id: "44444444-4444-4444-4444-444444444444", name: "20' Dry", code: "20DV",
  idsEquivalentes: ["44444444-4444-4444-4444-444444444444"],
};

vi.mock("@/features/catalogos/hooks", () => ({
  useTiposContenedor: () => ({ data: [TIPO_DRY, TIPO_HC] }),
}));

vi.mock("@/features/catalogos", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  PortIdSelect: ({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) => (
    <button type="button" id={id} data-value={value} onClick={() => onChange(id)}>puerto</button>
  ),
}));

const useTopTarifasMock = vi.fn();
vi.mock("@/features/costeo/hooks/useTopTarifas", () => ({
  useTopTarifas: (...args: unknown[]) => useTopTarifasMock(...args),
}));
const diagMock = vi.fn((_: { enabled: boolean }) => ({ diagnostico: undefined }));
vi.mock("@/features/costeo/hooks/useDiagnosticoTarifas", () => ({
  useDiagnosticoTarifas: (a: { enabled: boolean }) => diagMock(a),
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

  it("conserva el tipo elegido con teclado y lo envía a la consulta", async () => {
    render(<CosteoBuscar />, { wrapper: createWrapper() });

    const trigger = screen.getByLabelText("Tipo contenedor");
    fireEvent.keyDown(trigger, { key: "Enter" });
    const listbox = await screen.findByRole("listbox");
    const opciones = within(listbox).getAllByRole("option");
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(opciones[1], { key: "Enter" });

    expect(screen.getByLabelText("Tipo contenedor")).toHaveTextContent("40' High Cube");
    expect(useTopTarifasMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ tipoContenedorId: TIPO_HC.id }),
    );
  });
});

async function elegirTodo() {
  render(<CosteoBuscar />, { wrapper: createWrapper() });
  fireEvent.click(document.getElementById("buscar-origen")!);
  fireEvent.click(document.getElementById("buscar-destino")!);
  fireEvent.click(screen.getByLabelText("Tipo contenedor"));
  fireEvent.click(within(await screen.findByRole("listbox")).getByText("40' High Cube"));
}

describe("CosteoBuscar — error vs sin resultados", () => {
  it("un fallo de consulta muestra error con Reintentar y no diagnostica", async () => {
    const refetch = vi.fn();
    useTopTarifasMock.mockReturnValue({
      data: [], isFetching: false, isError: true, isSuccess: false, refetch, tipoContenedorIds: [],
    });
    await elegirTodo();
    expect(screen.getByText("No pudimos consultar las tarifas")).toBeInTheDocument();
    expect(screen.queryByText(/No hay tarifas/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(refetch).toHaveBeenCalled();
    expect(diagMock).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("búsqueda exitosa vacía muestra sin resultados y sí diagnostica", async () => {
    useTopTarifasMock.mockReturnValue({
      data: [], isFetching: false, isError: false, isSuccess: true, refetch: vi.fn(), tipoContenedorIds: [],
    });
    await elegirTodo();
    expect(screen.queryByText("No pudimos consultar las tarifas")).toBeNull();
    expect(diagMock).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
  });
});
