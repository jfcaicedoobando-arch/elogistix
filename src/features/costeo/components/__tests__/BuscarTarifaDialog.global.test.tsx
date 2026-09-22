/**
 * Pasos verificados (etapa 1 rutas globales):
 * 1. Conserva los valores `initial` al abrir (cualquier país).
 * 2. No consulta el Top 3 cuando faltan IDs.
 * 3. Excluye el origen del selector de destino, así el mismo puerto no se busca.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const PUERTOS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Rotterdam", country: "Países Bajos", code: "NLRTM" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Veracruz", country: "México", code: "MXVER" },
  { id: "44444444-4444-4444-4444-444444444444", name: "Los Ángeles", country: "Estados Unidos", code: "USLAX" },
];

vi.mock("@/features/catalogos/hooks", () => ({
  usePuertos: () => ({ data: PUERTOS }),
  useTiposContenedor: () => ({ data: [{ id: "33333333-3333-3333-3333-333333333333", name: "40HC" }] }),
}));

const useTopTarifasMock = vi.fn();
vi.mock("@/features/costeo/hooks/useTopTarifas", () => ({
  useTopTarifas: (...args: unknown[]) => useTopTarifasMock(...args),
}));

import { BuscarTarifaDialog } from "../BuscarTarifaDialog";
import { createWrapper } from "@/test/utils/queryWrapper";

beforeEach(() => {
  useTopTarifasMock.mockReset();
  useTopTarifasMock.mockReturnValue({
    data: [], isFetching: false, error: null, refetch: vi.fn(), isRefetching: false,
  });
});

describe("BuscarTarifaDialog — puertos globales", () => {
  it("conserva los valores iniciales de ruta y contenedor", () => {
    render(
      <BuscarTarifaDialog
        open
        onOpenChange={() => {}}
        initial={{
          puertoOrigenId: PUERTOS[0].id,
          puertoDestinoId: PUERTOS[1].id,
          tipoContenedorId: "33333333-3333-3333-3333-333333333333",
        }}
      />,
      { wrapper: createWrapper() },
    );
    expect(document.getElementById("td-origen")).toHaveTextContent("Rotterdam, Países Bajos (NLRTM)");
    expect(document.getElementById("td-destino")).toHaveTextContent("Veracruz, México (MXVER)");
    expect(useTopTarifasMock).toHaveBeenCalledWith(
      expect.objectContaining({ puertoOrigenId: PUERTOS[0].id, puertoDestinoId: PUERTOS[1].id }),
    );
  });

  it("sin destino elegido pasa cadena vacía (el hook no consulta)", () => {
    render(
      <BuscarTarifaDialog open onOpenChange={() => {}} initial={{ puertoOrigenId: PUERTOS[2].id }} />,
      { wrapper: createWrapper() },
    );
    expect(useTopTarifasMock).toHaveBeenCalledWith(
      expect.objectContaining({ puertoOrigenId: PUERTOS[2].id, puertoDestinoId: "" }),
    );
  });

  it("excluye el origen del selector de destino", () => {
    render(
      <BuscarTarifaDialog open onOpenChange={() => {}} initial={{ puertoOrigenId: PUERTOS[1].id }} />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(document.getElementById("td-destino")!);
    const lista = within(screen.getByRole("listbox"));
    expect(lista.getByText("Los Ángeles, Estados Unidos (USLAX)")).toBeInTheDocument();
    expect(lista.queryByText("Veracruz, México (MXVER)")).not.toBeInTheDocument();
  });
});
