/**
 * Botón "+ Nueva ruta" en Nueva tarifa (etapa rutas):
 * 1. Renderiza el acceso bajo el campo Rutas.
 * 2. Al crear la ruta desde el diálogo, notifica el id para seleccionarla
 *    sin cerrar el formulario de tarifa.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const PUERTOS = [
  { id: "p1", name: "Rotterdam", country: "Países Bajos", code: "NLRTM" },
  { id: "p2", name: "Veracruz", country: "México", code: "MXVER" },
];

vi.mock("@/features/catalogos/hooks", () => ({
  usePuertos: () => ({ data: PUERTOS }),
}));

const mutateAsync = vi.fn().mockResolvedValue({ id: "r9" });
vi.mock("@/features/costeo/hooks/useCosteoRutas", () => ({
  useCosteoRutaMutations: () => ({
    crear: { mutateAsync, isPending: false },
    eliminar: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

import { RutaQuickCreate } from "../RutaQuickCreate";

describe("RutaQuickCreate — alta de ruta desde Nueva tarifa", () => {
  beforeEach(() => {
    cleanup();
    mutateAsync.mockClear();
  });

  it("abre el diálogo de nueva ruta y notifica el id creado", async () => {
    const onCreada = vi.fn();
    render(<RutaQuickCreate rutas={[]} onCreada={onCreada} />);

    fireEvent.click(screen.getByRole("button", { name: /Nueva ruta/ }));
    expect(screen.getByText("Nueva ruta marítima")).toBeInTheDocument();

    fireEvent.click(document.getElementById("ruta-origen")!);
    fireEvent.click(screen.getByText("Rotterdam, Países Bajos (NLRTM)"));
    fireEvent.click(document.getElementById("ruta-destino")!);
    fireEvent.click(screen.getByText("Veracruz, México (MXVER)"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onCreada).toHaveBeenCalledWith("r9"));
  });
});
