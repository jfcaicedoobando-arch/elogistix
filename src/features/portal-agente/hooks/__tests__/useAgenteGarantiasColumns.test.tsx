import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AgenteGarantiaMobileCard } from "../useAgenteGarantiasColumns";
import type { FilaNaviera } from "@/features/costeo/types/filaNaviera";

const fila: FilaNaviera = { naviera_id: "n1", naviera_nombre: "COSCO", naviera_code: "COSU", condicion: null };

describe("garantías — requisito visible antes de abrir el formulario", () => {
  it("explica el requisito sin prometer configuración cuando no hay proveedores disponibles", () => {
    const onConfigurar = vi.fn();
    render(<AgenteGarantiaMobileCard fila={fila} onConfigurar={onConfigurar} proveedorDisponible={false} />);
    expect(screen.getByText(/Requiere proveedor tipo Naviera/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver requisito" }));
    expect(onConfigurar).toHaveBeenCalledWith(fila);
    expect(screen.queryByRole("button", { name: "Configurar" })).not.toBeInTheDocument();
  });

  it("mantiene la configuración disponible cuando se cumple el requisito", () => {
    render(<AgenteGarantiaMobileCard fila={fila} onConfigurar={vi.fn()} proveedorDisponible />);
    expect(screen.getByRole("button", { name: "Configurar" })).toBeEnabled();
    expect(screen.queryByText(/Requiere proveedor/)).not.toBeInTheDocument();
  });
});
