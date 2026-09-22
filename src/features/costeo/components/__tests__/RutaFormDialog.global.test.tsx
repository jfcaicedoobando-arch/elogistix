/**
 * Pasos verificados (etapa 1 rutas globales):
 * 1. Ofrece puertos de cualquier país como origen y como destino.
 * 2. Crea la ruta con los IDs seleccionados (Rotterdam → Veracruz).
 * 3. Bloquea origen == destino y detecta duplicado direccional (no el inverso).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const PUERTOS = [
  { id: "p1", name: "Rotterdam", country: "Países Bajos", code: "NLRTM" },
  { id: "p2", name: "Veracruz", country: "México", code: "MXVER" },
  { id: "p3", name: "Houston", country: "Estados Unidos", code: "USHOU" },
  { id: "p4", name: "Manzanillo", country: "México", code: "MXZLO" },
];

vi.mock("@/features/catalogos/hooks", () => ({
  usePuertos: () => ({ data: PUERTOS }),
}));

import { RutaFormDialog } from "../RutaFormDialog";
import type { CosteoRuta } from "@/features/costeo/types";

function crearMock() {
  return { mutateAsync: vi.fn().mockResolvedValue({ id: "r1" }), isPending: false } as never;
}

const abrir = (id: string) => fireEvent.click(document.getElementById(id)!);

describe("RutaFormDialog — rutas globales", () => {
  it("lista puertos de cualquier país como origen", () => {
    render(<RutaFormDialog open onOpenChange={() => {}} crear={crearMock()} rutas={[]} />);
    abrir("ruta-origen");
    expect(screen.getByText("Rotterdam, Países Bajos (NLRTM)")).toBeInTheDocument();
    expect(screen.getByText("Houston, Estados Unidos (USHOU)")).toBeInTheDocument();
  });

  it("crea la ruta global con los IDs elegidos", async () => {
    const crear = crearMock() as unknown as { mutateAsync: ReturnType<typeof vi.fn> };
    render(<RutaFormDialog open onOpenChange={() => {}} crear={crear as never} rutas={[]} />);
    abrir("ruta-origen");
    fireEvent.click(screen.getByText("Rotterdam, Países Bajos (NLRTM)"));
    abrir("ruta-destino");
    fireEvent.click(screen.getByText("Veracruz, México (MXVER)"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(crear.mutateAsync).toHaveBeenCalledWith({
        puerto_origen_id: "p1",
        puerto_destino_id: "p2",
      }),
    );
  });

  it("excluye el origen del selector de destino (no permite mismo puerto)", () => {
    render(<RutaFormDialog open onOpenChange={() => {}} crear={crearMock()} rutas={[]} />);
    abrir("ruta-origen");
    fireEvent.click(screen.getByText("Houston, Estados Unidos (USHOU)"));
    abrir("ruta-destino");
    const lista = within(screen.getByRole("listbox"));
    expect(lista.queryByText("Houston, Estados Unidos (USHOU)")).not.toBeInTheDocument();
    expect(lista.getByText("Veracruz, México (MXVER)")).toBeInTheDocument();
  });

  it("detecta duplicado direccional y no considera duplicada la ruta inversa", () => {
    const rutas = [
      { id: "r0", puerto_origen_id: "p4", puerto_destino_id: "p3" } as CosteoRuta,
    ];
    render(<RutaFormDialog open onOpenChange={() => {}} crear={crearMock()} rutas={rutas} />);
    abrir("ruta-origen");
    fireEvent.click(screen.getByText("Manzanillo, México (MXZLO)"));
    abrir("ruta-destino");
    fireEvent.click(screen.getByText("Houston, Estados Unidos (USHOU)"));
    expect(screen.getByRole("alert")).toHaveTextContent("ya está registrada");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("la ruta inversa sí es válida", () => {
    const rutas = [
      { id: "r0", puerto_origen_id: "p4", puerto_destino_id: "p3" } as CosteoRuta,
    ];
    render(<RutaFormDialog open onOpenChange={() => {}} crear={crearMock()} rutas={rutas} />);
    abrir("ruta-origen");
    fireEvent.click(screen.getByText("Houston, Estados Unidos (USHOU)"));
    abrir("ruta-destino");
    fireEvent.click(screen.getByText("Manzanillo, México (MXZLO)"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled();
  });
});
