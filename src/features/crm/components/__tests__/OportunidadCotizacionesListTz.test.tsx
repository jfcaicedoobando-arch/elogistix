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

function renderLista(fechaEnvio: string | null, createdAt = "2026-01-01T00:00:00Z") {
  mocks.cotizaciones.mockReturnValue({
    data: [
      {
        id: "cot-1",
        folio: "COT-1",
        estado: "Enviada",
        total: 1000,
        moneda: "MXN",
        created_at: createdAt,
        fecha_envio: fechaEnvio,
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
  it("CRM-P2.4: un borrador antiguo enviado hoy no muestra la etiqueta", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    // Creada hace meses, pero enviada el mismo día de negocio CDMX.
    renderLista("2026-09-04T20:00:00Z", "2026-05-01T18:00:00Z");
    expect(screen.queryByText(/Sin respuesta/)).toBeNull();
  });

  it("CRM-P2.4: sin fecha de envío no se inventan días", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    renderLista(null, "2026-05-01T18:00:00Z");
    expect(screen.queryByText(/Sin respuesta/)).toBeNull();
  });
});
