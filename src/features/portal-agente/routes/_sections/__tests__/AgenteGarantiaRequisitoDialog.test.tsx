import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AgenteGarantiaRequisitoDialog } from "../AgenteGarantiaRequisitoDialog";

describe("requisito de garantías del agente", () => {
  it("identifica la naviera y el siguiente paso sin ofrecer campos bloqueados", () => {
    const cerrar = vi.fn();
    render(<AgenteGarantiaRequisitoDialog seleccion={{ naviera_id: "n1", naviera_nombre: "COSCO",
      naviera_code: "COSU", condicion: null }} onOpenChange={cerrar} />);
    expect(screen.getByRole("dialog")).toHaveTextContent("COSCO · COSU");
    expect(screen.getByRole("dialog")).toHaveTextContent("Pide a Operaciones");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear condiciones" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    expect(cerrar).toHaveBeenCalledWith(false);
  });

  it("no abre un diálogo sin selección", () => {
    render(<AgenteGarantiaRequisitoDialog seleccion={null} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
