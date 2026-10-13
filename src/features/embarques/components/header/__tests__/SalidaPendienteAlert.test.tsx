import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SalidaPendienteAlert } from "../SalidaPendienteAlert";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-12T23:41:17Z")); });
afterEach(() => vi.useRealTimers());
describe("SalidaPendienteAlert", () => {
  it("explica que una ETD vencida no prueba salida ni genera aviso", () => {
    render(<SalidaPendienteAlert estado="Confirmado" etd="2026-09-15" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Salida pendiente de confirmar");
    expect(screen.getByRole("alert")).toHaveTextContent("no cambia el estado ni genera un aviso de salida al cliente");
  });
  it("desaparece cuando el operador ya confirmó la salida", () => {
    const { rerender } = render(<SalidaPendienteAlert estado="Confirmado" etd="2026-09-15" />);
    rerender(<SalidaPendienteAlert estado="En Tránsito" etd="2026-09-15" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("no inventa alerta para Borrador o ETD futura", () => {
    const { rerender } = render(<SalidaPendienteAlert estado="Borrador" etd="2026-09-15" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    rerender(<SalidaPendienteAlert estado="Confirmado" etd="2026-11-15" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
