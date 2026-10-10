import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
vi.mock("@/features/catalogos/hooks", () => ({ useTcDofPorFecha: () => ({ data: { usdMxn: 20.25, fecha: "2026-10-10" }, isFetching: false }) }));
import { TipoCambioCotizacionCard } from "../TipoCambioCotizacionCard";
function Harness() {
  const [value, onChange] = useState<number | null>(null);
  return <><TipoCambioCotizacionCard value={value} onChange={onChange} monedaCanonica="MXN" /><output data-testid="tc-state">{value == null ? "null" : value}</output></>;
}
describe("entrada TC sin reinterpretación de signos ni texto", () => {
  it.each(["0", "-1", "-20.5", "NaN", "Infinity", "abc", "1e2", "0x14", "20,50", "1,234.50", "MXN 20.50", "20.5.1"])("entrada/pegado inválido %s conserva bloqueo y error", (raw) => {
    render(<Harness />); const input = screen.getByLabelText("Tipo de cambio USD/MXN *");
    fireEvent.paste(input, { clipboardData: { getData: () => raw } });
    fireEvent.change(input, { target: { value: raw } });
    expect(screen.getByTestId("tc-state")).toHaveTextContent("null");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("mayor que cero");
    fireEvent.blur(input); expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it.each([["20.5", "20.5"], [" 20.50 ", "20.5"], ["0.5", "0.5"], [".5", "0.5"], ["18.", "18"]])("decimal válido %s conserva valor exacto %s", (raw, value) => {
    render(<Harness />); const input = screen.getByLabelText("Tipo de cambio USD/MXN *");
    fireEvent.paste(input, { clipboardData: { getData: () => raw } });
    fireEvent.change(input, { target: { value: raw } });
    expect(screen.getByTestId("tc-state")).toHaveTextContent(value); expect(input).toHaveAttribute("aria-invalid", "false");
  });
  it("reemplazar TC válido por -1 no reutiliza el valor previo ni guarda 1", () => {
    render(<Harness />); const input = screen.getByLabelText("Tipo de cambio USD/MXN *");
    fireEvent.change(input, { target: { value: "20" } });
    fireEvent.change(input, { target: { value: "-1" } });
    expect(screen.getByTestId("tc-state")).toHaveTextContent("null"); expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Traer TC DOF de hoy" }));
    expect(screen.getByTestId("tc-state")).toHaveTextContent("20.25"); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("teclear signo y luego dígito tras un TC válido nunca convierte negativo en positivo", () => {
    render(<Harness />); const input = screen.getByLabelText("Tipo de cambio USD/MXN *") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "20" } });
    fireEvent.change(input, { target: { value: "-" } });
    expect(input).toHaveValue("-");
    fireEvent.change(input, { target: { value: `${input.value}2` } });
    expect(input).toHaveValue("-2"); expect(screen.getByTestId("tc-state")).toHaveTextContent("null");
    fireEvent.blur(input); expect(input).toHaveValue("-2"); expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it("borrar el TC conserva null y no inventa un cambio", () => {
    render(<Harness />); const input = screen.getByLabelText("Tipo de cambio USD/MXN *");
    fireEvent.change(input, { target: { value: "20" } }); fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByTestId("tc-state")).toHaveTextContent("null");
  });
});
