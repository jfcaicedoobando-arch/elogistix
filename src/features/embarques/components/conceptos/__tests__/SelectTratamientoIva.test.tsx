import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SelectTratamientoIva } from "../SelectTratamientoIva";
import { cambioDesdeTipoIva } from "@/features/embarques/domain/cambioTratamientoIva";

describe("SelectTratamientoIva", () => {
  it("deriva tasa y switch coherentes por tratamiento", () => {
    expect(cambioDesdeTipoIva("gravado_16")).toEqual({ tipoIva: "gravado_16", tasaIva: 0.16, aplicaIva: true });
    expect(cambioDesdeTipoIva("gravado_8")).toEqual({ tipoIva: "gravado_8", tasaIva: 0.08, aplicaIva: true });
    expect(cambioDesdeTipoIva("tasa_0")).toEqual({ tipoIva: "tasa_0", tasaIva: 0, aplicaIva: false });
    expect(cambioDesdeTipoIva("no_objeto")).toEqual({ tipoIva: "no_objeto", tasaIva: 0, aplicaIva: false });
  });
  it("resalta la línea heredada sin clasificar", () => {
    render(<SelectTratamientoIva aplicaIva={false} tasaIva={0} onChange={() => {}} />);
    expect(screen.getByTestId("tratamiento-iva-pendiente")).toHaveTextContent("IVA: Por definir");
  });
  it("no resalta una línea ya clasificada", () => {
    render(<SelectTratamientoIva tipoIva="exento" onChange={() => {}} />);
    expect(screen.queryByTestId("tratamiento-iva-pendiente")).toBeNull();
    expect(screen.getByLabelText("Tratamiento de IVA")).toHaveTextContent("IVA: Exento");
  });
});
