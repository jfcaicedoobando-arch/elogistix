/**
 * Las tarjetas de "Esta semana" no deben mentir: si la consulta falló,
 * muestran error + reintento, nunca "Sin oportunidades" o "Todos atendidos".
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CerrandoSemanaCard, LeadsSinContactarCard } from "../DealsCards";

function renderConRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("DealsCards · estados de error", () => {
  it("CerrandoSemanaCard muestra error y reintento", () => {
    const onRetry = vi.fn();
    renderConRouter(<CerrandoSemanaCard items={[]} isError onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Sin oportunidades por cerrar")).toBeNull();
    screen.getByRole("button", { name: /reintentar/i }).click();
    expect(onRetry).toHaveBeenCalled();
  });

  it("LeadsSinContactarCard muestra error y no dice que todo está atendido", () => {
    renderConRouter(<LeadsSinContactarCard items={[]} isError onRetry={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/Todos los leads nuevos/)).toBeNull();
  });

  it("sin error conserva el estado vacío existente", () => {
    renderConRouter(<CerrandoSemanaCard items={[]} />);
    expect(screen.getByText("Sin oportunidades por cerrar")).toBeInTheDocument();
    renderConRouter(<LeadsSinContactarCard items={[]} />);
    expect(screen.getByText(/Todos los leads nuevos/)).toBeInTheDocument();
  });

  it("formatea la fecha estimada de cierre en español", () => {
    renderConRouter(
      <CerrandoSemanaCard
        items={[
          {
            id: "op-1",
            nombre: "Oportunidad con fecha",
            monto_estimado: 100000,
            moneda: "MXN",
            probabilidad: 75,
            fecha_estimada_cierre: "2026-09-15",
          },
        ]}
      />,
    );
    // toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })
    expect(screen.getByText(/15\/09\/2026|15\/9\/2026|15 de septiembre de 2026/i)).toBeInTheDocument();
  });

  it("muestra 'Sin fecha' cuando no hay fecha estimada de cierre", () => {
    renderConRouter(
      <CerrandoSemanaCard
        items={[
          {
            id: "op-2",
            nombre: "Oportunidad sin fecha",
            monto_estimado: 50000,
            moneda: "MXN",
            probabilidad: 50,
            fecha_estimada_cierre: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("Sin fecha · 50%")).toBeInTheDocument();
  });
});
