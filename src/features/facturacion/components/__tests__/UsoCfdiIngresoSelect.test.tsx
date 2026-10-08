import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UsoCfdiIngresoSelect } from "../UsoCfdiIngresoSelect";

describe("selección de uso CFDI de ingreso", () => {
  it("mantiene G03 heredado visible para 616 con motivo y sólo ofrece S01", () => {
    const onChange = vi.fn();
    render(<UsoCfdiIngresoSelect value="G03" onChange={onChange} receptor={{ rfc: "XAXX010101000", regimen: "616" }} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("G03");
    expect(screen.getByRole("alert")).toHaveTextContent("no es compatible con el régimen fiscal 616");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent("S01");
  });
  it("cambiar régimen recalcula opciones y error sin sustituir la selección", () => {
    const onChange = vi.fn();
    const { rerender } = render(<UsoCfdiIngresoSelect value="G03" onChange={onChange} receptor={{ rfc: "AAAA010101AAA", regimen: "612" }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    rerender(<UsoCfdiIngresoSelect value="G03" onChange={onChange} receptor={{ rfc: "AAAA010101AAA", regimen: "616" }} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("G03");
    expect(screen.getByRole("alert")).toHaveTextContent("616");
    expect(onChange).not.toHaveBeenCalled();
  });
  it("sin receptor sólo ofrece usos I y conserva P01 legado con motivo", () => {
    render(<UsoCfdiIngresoSelect value="P01" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("P01");
    expect(screen.getByRole("alert")).toHaveTextContent("no es válido");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    const opciones = screen.getAllByRole("option").map((o) => o.textContent).join(" ");
    expect(opciones).not.toMatch(/P01|CP01|CN01/);
    expect(opciones).toContain("G03");
  });
});
