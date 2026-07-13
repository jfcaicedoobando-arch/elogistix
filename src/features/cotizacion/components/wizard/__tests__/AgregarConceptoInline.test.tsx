/**
 * Tests P2 cierre (v13.296.0) — AgregarConceptoInline.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgregarConceptoInline } from "@/features/cotizacion/components/wizard/AgregarConceptoInline";

// Mock del selector SAT: expone un botón que dispara onSelect con un producto.
vi.mock("@/features/cotizacion/components/conceptos/ProductoServicioSelect", () => ({
  ProductoServicioSelect: ({
    onSelect,
  }: {
    onSelect: (p: {
      id: string;
      nombre: string;
      nombre_unidad: string | null;
      tipo_iva: "gravado_16" | "tasa_0" | "exento";
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onSelect({
          id: "sat-1",
          nombre: "Flete marítimo",
          nombre_unidad: "SER",
          tipo_iva: "gravado_16",
        })
      }
      data-testid="mock-sat-select"
    >
      pick
    </button>
  ),
}));

describe("AgregarConceptoInline", () => {
  const openPopover = async () => {
    fireEvent.click(screen.getByTestId("agregar-concepto-inline"));
  };

  it("no permite Agregar hasta seleccionar producto", async () => {
    render(<AgregarConceptoInline onAgregar={vi.fn()} />);
    await openPopover();
    const btn = screen.getByRole("button", { name: /^agregar$/i });
    expect(btn).toBeDisabled();
  });

  it("dispara onAgregar con moneda, clave SAT y prefill al aceptar", async () => {
    const onAgregar = vi.fn();
    render(<AgregarConceptoInline onAgregar={onAgregar} monedaDefault="MXN" />);
    await openPopover();
    fireEvent.click(screen.getByTestId("mock-sat-select"));

    // Cambia precio unitario.
    const precio = screen.getByLabelText(/precio unitario/i);
    fireEvent.change(precio, { target: { value: "1500" } });

    fireEvent.click(screen.getByRole("button", { name: /^agregar$/i }));

    expect(onAgregar).toHaveBeenCalledTimes(1);
    const [moneda, prefill] = onAgregar.mock.calls[0];
    expect(moneda).toBe("MXN");
    expect(prefill).toMatchObject({
      descripcion: "Flete marítimo",
      unidad_medida: "SER",
      cantidad: 1,
      precio_unitario: 1500,
      aplica_iva: true,
      moneda: "MXN",
    });
  });

  it("toggle USD/MXN cambia la moneda propagada", async () => {
    const onAgregar = vi.fn();
    render(<AgregarConceptoInline onAgregar={onAgregar} monedaDefault="USD" />);
    await openPopover();
    fireEvent.click(screen.getByTestId("mock-sat-select"));

    // Cambia a MXN.
    fireEvent.click(screen.getByRole("button", { name: "MXN" }));
    fireEvent.click(screen.getByRole("button", { name: /^agregar$/i }));

    expect(onAgregar.mock.calls[0][0]).toBe("MXN");
  });

  it("oculta el toggle cuando monedaFija está definida", async () => {
    render(<AgregarConceptoInline onAgregar={vi.fn()} monedaFija="USD" />);
    await openPopover();
    // Al fijar moneda, no se renderizan los botones USD/MXN
    expect(screen.queryByRole("button", { name: "USD" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "MXN" })).not.toBeInTheDocument();
  });
});
