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
});
