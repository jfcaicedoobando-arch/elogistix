import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PortalEmbarqueResumenTab } from "../embarqueDetalle/PortalEmbarqueResumenTab";

const base = {
  modo: "Marítimo",
  tipo: "Importación",
  incoterm: "FOB",
  etd: "2026-07-01",
  eta: "2026-07-25",
};

describe("PortalEmbarqueResumenTab (B-102)", () => {
  it("muestra los datos operativos de carga cuando existen", () => {
    render(
      <PortalEmbarqueResumenTab
        embarque={{
          ...base,
          tipo_contenedor: "40HC",
          peso_kg: 12500,
          volumen_m3: 58.4,
          piezas: 320,
          contenedor: "MSCU1234567",
          bl_master: "BLM-1",
          bl_house: "BLH-1",
        } as never}
      />,
    );
    expect(screen.getByText("Tipo de contenedor")).toBeInTheDocument();
    expect(screen.getByText("40HC")).toBeInTheDocument();
    expect(screen.getByText(/12,500 kg/)).toBeInTheDocument();
    expect(screen.getByText(/m³/)).toBeInTheDocument();
    expect(screen.getByText("MSCU1234567")).toBeInTheDocument();
    expect(screen.getByText("BLM-1")).toBeInTheDocument();
    expect(screen.getByText("BLH-1")).toBeInTheDocument();
  });

  it("oculta los campos numéricos en cero o nulos", () => {
    render(
      <PortalEmbarqueResumenTab
        embarque={{ ...base, peso_kg: 0, volumen_m3: null, piezas: null } as never}
      />,
    );
    expect(screen.queryByText("Peso")).not.toBeInTheDocument();
    expect(screen.queryByText("Volumen")).not.toBeInTheDocument();
    expect(screen.queryByText("Piezas")).not.toBeInTheDocument();
    expect(screen.queryByText("Contenedor")).not.toBeInTheDocument();
  });

  it("muestra guion cuando no hay ETD/ETA", () => {
    render(<PortalEmbarqueResumenTab embarque={{ ...base, etd: null, eta: null } as never} />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });
});
