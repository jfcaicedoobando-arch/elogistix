import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DireccionFiscalFields } from "../DireccionFiscalFields";

describe("DireccionFiscalFields", () => {
  const baseForm = { cp: "64000", regimen_fiscal: "601", direccion: "Av. Reforma 100", ciudad: "CDMX", estado: "CDMX" };

  it("renderiza los 5 campos con sus valores", () => {
    render(<DireccionFiscalFields form={baseForm} setField={() => {}} />);
    expect(screen.getByDisplayValue("64000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Av. Reforma 100")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("CDMX")).toHaveLength(2);
  });

  it("marca régimen como requerido con regimenRequired", () => {
    render(<DireccionFiscalFields form={baseForm} setField={() => {}} regimenRequired />);
    expect(screen.getByText("Régimen Fiscal *")).toBeInTheDocument();
  });

  it("sin regimenRequired no muestra asterisco", () => {
    render(<DireccionFiscalFields form={baseForm} setField={() => {}} />);
    expect(screen.getByText("Régimen Fiscal")).toBeInTheDocument();
    expect(screen.queryByText("Régimen Fiscal *")).not.toBeInTheDocument();
  });

  it("filtra caracteres no numéricos del CP", () => {
    const setField = vi.fn();
    render(<DireccionFiscalFields form={{ ...baseForm, cp: "" }} setField={setField} />);
    const cp = screen.getByPlaceholderText("64000") as HTMLInputElement;
    fireEvent.change(cp, { target: { value: "64abc000" } });
    expect(setField).toHaveBeenCalledWith("cp", "64000");
  });

  it("acepta form con valores null/undefined sin romper", () => {
    render(<DireccionFiscalFields form={{ cp: null, regimen_fiscal: null, direccion: undefined, ciudad: null, estado: null }} setField={() => {}} />);
    expect(screen.getByPlaceholderText("64000")).toHaveValue("");
  });
});
