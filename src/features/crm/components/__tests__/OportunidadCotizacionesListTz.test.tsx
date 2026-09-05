/**
 * Regresión TZ: la etiqueta "Sin respuesta · Nd" usa el calendario CDMX,
 * así que no cambia según la zona del navegador cerca de medianoche.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OportunidadCotizacionesList from "../OportunidadCotizacionesList";

const mocks = vi.hoisted(() => ({ cotizaciones: vi.fn() }));

vi.mock("@/features/crm/hooks", () => ({
  useOportunidadCotizaciones: () => mocks.cotizaciones(),
}));

// 2026-09-05 03:30 UTC = 2026-09-04 21:30 en CDMX.
const AHORA = new Date("2026-09-05T03:30:00Z");

function renderLista(createdAt: string) {
  mocks.cotizaciones.mockReturnValue({
    data: [
      {
        id: "cot-1",
        folio: "COT-1",
        estado: "Enviada",
        total: 1000,
        moneda: "MXN",
        created_at: createdAt,
      },
    ],
    isLoading: false,
  });
  render(
    <MemoryRouter>
      <OportunidadCotizacionesList oportunidadId="op-1" />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("OportunidadCotizacionesList · días sin respuesta (CDMX)", () => {
  it("cuenta los días contra el día de negocio CDMX, no el UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    // 2026-08-28 en CDMX → 7 días de diferencia contra el 04/09 CDMX.
    renderLista("2026-08-28T18:00:00Z");
    expect(screen.getByText(/Sin respuesta · 7d/)).toBeInTheDocument();
  });

  it("respeta el umbral: 5 días o menos no muestra la etiqueta", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    renderLista("2026-08-30T18:00:00Z");
    expect(screen.queryByText(/Sin respuesta/)).toBeNull();
  });
});
