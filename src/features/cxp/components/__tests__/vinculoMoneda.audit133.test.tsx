import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VincularConceptoRow } from "../VincularConceptoRow";
import { TopeVinculacionBar } from "../TopeVinculacionBar";
import { SugerenciasOperacionesBanda } from "../SugerenciasOperacionesBanda";
import { avisoMonedasVinculo } from "../../utils/vinculoMoneda";
import { calcularTopeVinculacion } from "../../utils/topeVinculacion";

const costo = { id: "c1", embarque_id: "e1", embarque_expediente: "ELNAC17",
  concepto: "Flete", monto: 20.44, moneda: "MXN", fecha_vencimiento: null };
const props = { concepto: costo, seleccion: undefined, onToggle: vi.fn(), onChangeMonto: vi.fn(),
  facturaMoneda: "EUR", tc: { usdMxn: 17, eurMxn: 20.44 } };

describe("auditoría 133 · selección y validación visibles", () => {
  it("bloquea EUR/MXN antes de seleccionarlo, sin equivalencia ni aviso falso de falta de T/C", () => {
    render(<VincularConceptoRow {...props} />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByText(/Esta vinculación EUR\/MXN/)).toHaveTextContent("Conserva las monedas reales");
    expect(screen.queryByText(/falta el tipo de cambio/)).toBeNull();
    expect(screen.queryByText(/≈/)).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(props.onToggle).not.toHaveBeenCalled();
  });

  it("permite desmarcar una selección anterior incompatible y no editar su importe", () => {
    const onToggle = vi.fn();
    render(<VincularConceptoRow {...props} seleccion={{ monto: 1 }} onToggle={onToggle} />);
    expect(screen.getByRole("checkbox")).toBeEnabled();
    expect(screen.getByLabelText(/Importe aplicado/)).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith(costo, false, undefined);
  });

  it("permite EUR/EUR y la selección conserva el importe", () => {
    const onToggle = vi.fn();
    const eur = { ...costo, moneda: "EUR", monto: 1 };
    render(<VincularConceptoRow {...props} concepto={eur} tc={null} onToggle={onToggle} />);
    expect(screen.getByRole("checkbox")).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith(eur, true, undefined);
    expect(screen.queryByText(/todavía no está disponible/)).toBeNull();
  });

  it("mantiene MXN/USD con TC y permite quitarlo incluso si el TC deja de estar disponible", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<VincularConceptoRow {...props} facturaMoneda="USD" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith(costo, true, 1.2);
    rerender(<VincularConceptoRow {...props} facturaMoneda="USD" tc={null} seleccion={{ monto: 1.2 }} onToggle={onToggle} />);
    expect(screen.getByRole("checkbox")).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenLastCalledWith(costo, false, undefined);
  });

  it("no presenta validación verde para una selección incompatible aunque cuadre el subtotal", () => {
    render(<TopeVinculacionBar moneda="EUR" subtotal={1}
      resultado={calcularTopeVinculacion(1, { c1: { monto: 1 } })}
      errorMoneda={avisoMonedasVinculo("MXN", "EUR")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("EUR/MXN");
    expect(screen.queryByText("Lo asignado cabe en el importe de la factura")).toBeNull();
  });

  it("explica que una sugerencia incompatible no se resuelve obteniendo otro TC", () => {
    render(<SugerenciasOperacionesBanda aplicados={[]} descartados={[]} sinCostoCapturado={false}
      monedaNoSoportada={[{ conceptoCostoId: "c1", concepto: "Flete", monto: 20.44, moneda: "MXN" }]}
      marcadosAhora={0} onQuitarTodos={vi.fn()} onReaplicar={vi.fn()} />);
    expect(screen.getByText(/la vinculación entre estas monedas/)).toHaveTextContent("Conserva las monedas reales");
    expect(screen.queryByText(/Márcalo a mano cuando el tipo de cambio/)).toBeNull();
  });
});
