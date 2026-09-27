import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useVolverAgendaActividad } from "../useVolverAgendaActividad";

function Probe() {
  const volver = useVolverAgendaActividad();
  const location = useLocation();
  return <><button onClick={volver}>Guardado</button><output>{location.pathname + location.search + location.hash}</output></>;
}

describe("volver de alta de actividad", () => {
  it.each(["/crm/actividades", "/crm/actividades/"])("conserva todos los parámetros y el hash desde %s", path => {
    const url = `${path}?q=resinas&tipo=llamada&estado=completadas&responsable=mias&sort=asunto&dir=desc&page=3&ps=50#agenda`;
    render(<MemoryRouter initialEntries={[url]}><Probe /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Guardado" }));
    expect(screen.getByRole("status")).toHaveTextContent(url);
  });

  it("abre la agenda canónica cuando el alta fue desde otra pantalla", () => {
    render(<MemoryRouter initialEntries={["/crm/leads/l1?q=otro"]}><Probe /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Guardado" }));
    expect(screen.getByRole("status")).toHaveTextContent(/^\/crm\/actividades$/);
  });
});
