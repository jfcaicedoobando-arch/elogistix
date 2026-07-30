/**
 * R-01 — Regresión: capturar Cant=2, Costo=15000, Venta=20000 debe persistir
 * exactamente esos valores (antes se contaminaban entre campos y la cantidad
 * se reescribía a 9,999 por el clamp `CANTIDAD_MAX`).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilaCostoLocalRow } from "@/features/cotizacion/components/costosLocal/FilaCostoLocalRow";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

vi.mock("@/features/cotizacion/components/conceptos/ProductoServicioSelect", () => ({
  ProductoServicioSelect: () => <div data-testid="producto-select" />,
}));
vi.mock("@/features/cotizacion/components/conceptos/UnidadMedidaSelect", () => ({
  UnidadMedidaSelect: () => <div data-testid="unidad-select" />,
}));

const filaBase = {
  concepto: "Flete",
  clave_sat: "78101800",
  concepto_libre: false,
  proveedor: "",
  unidad_medida: "E48",
  cantidad: 1,
  costo_unitario: 0,
  precio_venta: 0,
  moneda: "MXN",
  aplica_iva: true,
  tasa_iva_aplicada: 0.16,
  notas: "",
} as unknown as FilaCostoLocal;

function teclear(label: string, texto: string) {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  // tecleo secuencial: cada carácter dispara un change como en el navegador
  let acumulado = "";
  for (const ch of texto) {
    acumulado += ch;
    fireEvent.change(input, { target: { value: acumulado } });
  }
  fireEvent.blur(input);
}

describe("FilaCostoLocalRow · captura numérica (R-01)", () => {
  it("persiste cantidad, costo y venta tal cual se teclean", () => {
    const onUpdate = vi.fn();
    render(
      <FilaCostoLocalRow fila={filaBase} gi={0} moneda="MXN" onUpdate={onUpdate} onRemove={vi.fn()} />,
    );

    teclear("Cantidad", "2");
    teclear("Costo unitario", "15000");
    teclear("Precio de venta", "20000");

    // Sólo se propaga en blur: una llamada por campo, con el valor exacto.
    expect(onUpdate.mock.calls).toEqual([
      [0, "cantidad", 2],
      [0, "costo_unitario", 15000],
      [0, "precio_venta", 20000],
    ]);
  });

  it("no reescribe cantidades altas (sin clamp a 9,999)", () => {
    const onUpdate = vi.fn();
    render(
      <FilaCostoLocalRow fila={filaBase} gi={3} moneda="MXN" onUpdate={onUpdate} onRemove={vi.fn()} />,
    );

    teclear("Cantidad", "15000");

    expect(onUpdate).toHaveBeenCalledWith(3, "cantidad", 15000);
  });

  it("calcula los totales de la partida con los valores capturados", () => {
    const fila = { ...filaBase, cantidad: 2, costo_unitario: 15000, precio_venta: 20000 } as FilaCostoLocal;
    render(
      <FilaCostoLocalRow fila={fila} gi={0} moneda="MXN" onUpdate={vi.fn()} onRemove={vi.fn()} />,
    );

    expect(screen.getByText(/30,000/)).toBeInTheDocument();
    expect(screen.getByText(/40,000/)).toBeInTheDocument();
  });
});
