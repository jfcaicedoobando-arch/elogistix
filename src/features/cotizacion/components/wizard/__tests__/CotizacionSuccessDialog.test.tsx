/**
 * Tests para CotizacionSuccessDialog (P0 — v13.293.1).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CotizacionSuccessDialog } from "@/features/cotizacion/components/wizard/CotizacionSuccessDialog";

function setup(overrides: Partial<React.ComponentProps<typeof CotizacionSuccessDialog>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    folio: "COT-2026-0001" as string | null,
    onEnviarProforma: vi.fn(),
    onCrearEmbarque: vi.fn(),
    onDuplicar: vi.fn(),
    onIrAlListado: vi.fn(),
    onVerDetalle: vi.fn(),
    ...overrides,
  };
  render(<CotizacionSuccessDialog {...props} />);
  return props;
}

describe("CotizacionSuccessDialog", () => {
  it("renderiza el folio cuando se provee", () => {
    setup();
    expect(screen.getByText(/COT-2026-0001/)).toBeInTheDocument();
  });

  it("renderiza sin folio cuando es null", () => {
    setup({ folio: null });
    expect(screen.queryByText(/COT-/)).not.toBeInTheDocument();
    expect(screen.getByText(/¿Qué sigue\?/)).toBeInTheDocument();
  });

  it("dispara los 5 handlers al click", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /Enviar proforma/i }));
    fireEvent.click(screen.getByRole("button", { name: /Crear embarque/i }));
    fireEvent.click(screen.getByRole("button", { name: /Duplicar/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ver listado/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ir al detalle/i }));
    expect(props.onEnviarProforma).toHaveBeenCalledTimes(1);
    expect(props.onCrearEmbarque).toHaveBeenCalledTimes(1);
    expect(props.onDuplicar).toHaveBeenCalledTimes(1);
    expect(props.onIrAlListado).toHaveBeenCalledTimes(1);
    expect(props.onVerDetalle).toHaveBeenCalledTimes(1);
  });

  it("no renderiza el contenido cuando open=false", () => {
    setup({ open: false });
    expect(screen.queryByText(/¿Qué sigue\?/)).not.toBeInTheDocument();
  });
});
