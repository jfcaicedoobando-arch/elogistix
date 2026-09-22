/**
 * P2 auditoría v13.824.3 — al cambiar de página el scroll vuelve al inicio;
 * los filtros (query string) y los anclas (#hash) no lo mueven.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { RouteScrollReset } from "../RouteScrollReset";

function Harness() {
  const navigate = useNavigate();
  return (
    <div>
      <RouteScrollReset />
      <button onClick={() => navigate("/costeo/tarifas")}>Otra ruta</button>
      <button onClick={() => navigate("/costeo/tarifas?estado=vigente")}>Filtrar</button>
      <button onClick={() => navigate("/costeo/tarifas#totales")}>Ir al ancla</button>
    </div>
  );
}

describe("RouteScrollReset", () => {
  let scrollTo: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sube al inicio al cambiar de ruta", () => {
    render(
      <MemoryRouter initialEntries={["/costeo/rutas"]}>
        <Harness />
      </MemoryRouter>,
    );
    expect(scrollTo).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /otra ruta/i }));

    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "instant" });
  });

  it("no mueve el scroll cuando sólo cambian los filtros de la URL", () => {
    render(
      <MemoryRouter initialEntries={["/costeo/tarifas"]}>
        <Harness />
      </MemoryRouter>,
    );
    const previas = scrollTo.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /filtrar/i }));

    expect(scrollTo).toHaveBeenCalledTimes(previas);
  });

  it("respeta el salto a un ancla", () => {
    render(
      <MemoryRouter initialEntries={["/costeo/rutas"]}>
        <Harness />
      </MemoryRouter>,
    );
    const previas = scrollTo.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /ir al ancla/i }));

    expect(scrollTo).toHaveBeenCalledTimes(previas);
  });
});
