/**
 * N-UI-01 (Ola 7) · badge unificado de carta garantía: cubre los cuatro estados
 * en ambas formas de props y el formato de fecha DD/MM/YYYY.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CartaGarantiaBadge } from "@/features/cotizacion/components/CartaGarantiaBadge";
import type { TopTarifaRow } from "@/features/costeo/types";

const HOY = new Date();
const iso = (dias: number) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

function tarifaCon(tieneCarta: boolean, vigenteHasta: string | null): TopTarifaRow {
  return {
    naviera_nombre: "Maersk",
    naviera_tiene_carta_garantia: tieneCarta,
    naviera_carta_garantia_vigente_hasta: vigenteHasta,
  } as TopTarifaRow;
}

describe("<CartaGarantiaBadge /> (unificado)", () => {
  it("props manuales: sin carta avisa que se cobrará depósito", () => {
    render(<CartaGarantiaBadge tieneCarta={false} vigenteHasta={null} />);
    expect(screen.getByText(/sin carta garantía — se cobrará depósito/i)).toBeInTheDocument();
  });

  it("props manuales: vencida muestra la fecha en DD/MM/YYYY", () => {
    render(<CartaGarantiaBadge tieneCarta vigenteHasta="2026-07-01" />);
    expect(screen.getByText(/vencida el 01\/07\/2026 — se cobrará depósito/i)).toBeInTheDocument();
  });

  it("props manuales: vigente incluye la naviera cuando se pasa", () => {
    render(
      <CartaGarantiaBadge tieneCarta vigenteHasta={iso(120)} navieraNombre="Hapag" />,
    );
    expect(screen.getByText(/vigente hasta .*\(Hapag\)/i)).toBeInTheDocument();
  });

  it("forma { tarifa }: por vencer muestra la naviera de la tarifa", () => {
    render(<CartaGarantiaBadge tarifa={tarifaCon(true, iso(10))} />);
    expect(screen.getByText(/por vencer el .*\(Maersk\)/i)).toBeInTheDocument();
  });

  it("forma { tarifa }: vigente usa formato mexicano y no imprime el ISO crudo", () => {
    const hasta = iso(200);
    render(<CartaGarantiaBadge tarifa={tarifaCon(true, hasta)} />);
    expect(screen.queryByText(new RegExp(hasta))).not.toBeInTheDocument();
    expect(screen.getByText(/vigente hasta \d{2}\/\d{2}\/\d{4}/i)).toBeInTheDocument();
  });

  it("forma { tarifa }: sin carta no depende de la fecha", () => {
    render(<CartaGarantiaBadge tarifa={tarifaCon(false, null)} />);
    expect(screen.getByText(/sin carta garantía/i)).toBeInTheDocument();
  });
});
