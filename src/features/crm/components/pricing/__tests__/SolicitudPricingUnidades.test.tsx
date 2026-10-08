import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SolicitudPricingCampos, type DatosSolicitud } from "../SolicitudPricingCampos";

vi.mock("@/features/crm/hooks/usePricingCrm", () => ({ useUsuariosOrgCrm: () => ({ data: [] }) }));
vi.mock("@/features/catalogos/hooks", () => ({
  usePuertos: () => ({ data: [] }),
  useTiposContenedor: () => ({ data: [] }),
}));

function Formulario({ unidad }: { unidad?: string | null }) {
  const [datos, setDatos] = useState<DatosSolicitud>({ solicitante_id: "u1", peso: "100", dimensiones: "10x20x30", unidad_medida: unidad });
  return <SolicitudPricingCampos datos={datos} set={(campo, valor) => setDatos((prev) => ({ ...prev, [campo]: valor }))} />;
}

describe("unidad de medida de Pricing", () => {
  it("es opcional y se ubica entre peso y dimensiones", () => {
    render(<Formulario />);
    const peso = screen.getByLabelText("Weight");
    const unidad = screen.getByLabelText("Units of measurement");
    const dimensiones = screen.getByLabelText("Dimensions");
    expect(unidad).toHaveTextContent("—");
    expect(peso.compareDocumentPosition(unidad) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(unidad.compareDocumentPosition(dimensiones) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("recupera una unidad guardada al editar sin cambiar peso ni dimensiones", () => {
    render(<Formulario unidad="lb" />);
    expect(screen.getByLabelText("Units of measurement")).toHaveTextContent("Libras (lb)");
    expect(screen.getByLabelText("Weight")).toHaveValue("100");
    expect(screen.getByLabelText("Dimensions")).toHaveValue("10x20x30");
  });

  it("permite seleccionar una unidad y quitarla", async () => {
    render(<Formulario />);
    fireEvent.click(screen.getByLabelText("Units of measurement"));
    fireEvent.click(await screen.findByRole("option", { name: "Kilogramos (kg)" }));
    expect(screen.getByLabelText("Units of measurement")).toHaveTextContent("Kilogramos (kg)");
    fireEvent.click(screen.getByLabelText("Units of measurement"));
    fireEvent.click(await screen.findByRole("option", { name: "—" }));
    expect(screen.getByLabelText("Units of measurement")).toHaveTextContent("—");
  });
});