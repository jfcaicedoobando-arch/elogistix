/**
 * Landing: secciones nuevas (antes/después y recorrido del producto).
 * Verifican que el copy centralizado se renderice y que las pestañas del
 * recorrido cambien de panel.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LandingAntesDespues } from "../LandingAntesDespues";
import { LandingRecorrido } from "../LandingRecorrido";
import { ANTES_DESPUES, RECORRIDO } from "@/features/marketing/routes/landingCopy";

describe("LandingAntesDespues", () => {
  it("muestra las dos columnas y todas las filas de la comparativa", () => {
    render(<LandingAntesDespues />);
    expect(screen.getByRole("heading", { level: 2, name: ANTES_DESPUES.title })).toBeInTheDocument();
    expect(screen.getByText(ANTES_DESPUES.antesTitle)).toBeInTheDocument();
    expect(screen.getByText(ANTES_DESPUES.despuesTitle)).toBeInTheDocument();
    for (const fila of ANTES_DESPUES.filas) {
      expect(screen.getByText(fila.antes)).toBeInTheDocument();
      expect(screen.getByText(fila.despues)).toBeInTheDocument();
    }
  });
});

describe("LandingRecorrido", () => {
  it("abre en el primer paso y permite cambiar de pestaña", async () => {
    const user = userEvent.setup();
    render(<LandingRecorrido />);

    const [primero, segundo] = RECORRIDO.pasos;
    expect(screen.getByText(primero.folio)).toBeInTheDocument();
    expect(screen.queryByText(segundo.folio)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: segundo.tab }));
    expect(screen.getByText(segundo.folio)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: segundo.title })).toBeInTheDocument();
  });
});
