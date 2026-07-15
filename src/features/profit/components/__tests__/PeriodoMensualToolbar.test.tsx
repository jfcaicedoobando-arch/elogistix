/**
 * PeriodoMensualToolbar — Fase 4 UI/UX. Verifica que el selector unificado:
 * 1) muestra el mes activo, 2) navega con las flechas cuando puede, y
 * 3) deshabilita las flechas en los bordes del rango.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PeriodoMensualToolbar } from "../PeriodoMensualToolbar";
import type { MesDisponible } from "@/features/profit/hooks/usePeriodoMesUrl";

const meses: MesDisponible[] = [
  { key: "2026-05", label: "Mayo 2026", year: 2026, month: 5 },
  { key: "2026-06", label: "Junio 2026", year: 2026, month: 6 },
  { key: "2026-07", label: "Julio 2026", year: 2026, month: 7 },
];

describe("PeriodoMensualToolbar", () => {
  it("muestra el mes actual y llama onPrev/onNext", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <PeriodoMensualToolbar
        mesActual={meses[1]}
        mesesDisponibles={meses}
        onChange={vi.fn()}
        onPrev={onPrev}
        onNext={onNext}
        puedeIrAtras
        puedeIrAdelante
      />,
    );
    expect(screen.getByText(/Junio 2026/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Mes anterior/i));
    fireEvent.click(screen.getByLabelText(/Mes siguiente/i));
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("deshabilita las flechas en los bordes del rango", () => {
    render(
      <PeriodoMensualToolbar
        mesActual={meses[0]}
        mesesDisponibles={meses}
        onChange={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        puedeIrAtras={false}
        puedeIrAdelante
      />,
    );
    expect(screen.getByLabelText(/Mes anterior/i)).toBeDisabled();
    expect(screen.getByLabelText(/Mes siguiente/i)).not.toBeDisabled();
  });
});
