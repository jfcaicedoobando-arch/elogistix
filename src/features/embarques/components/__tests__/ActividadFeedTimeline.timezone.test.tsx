import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActividadFeedTimeline } from "../ActividadFeedTimeline";
import { agruparPorDia, type ActividadItem } from "../../domain/actividadFeed";

describe("historial: encabezado y horas CDMX", () => {
  it("muestra el instante UTC y sus registros relacionados bajo el día de negocio", () => {
    const evento: ActividadItem = {
      id: "e1", categoria: "operacion", tipo: "nota", usuario: "Coordinador",
      accion: "Nota", titulo: "ETA confirmada", fecha: "2026-09-27T02:50:30Z",
    };
    render(<ActividadFeedTimeline grupos={agruparPorDia([
      { ...evento, relacionados: [{ ...evento, id: "e2", fecha: "2026-09-27T03:00:00Z" }] },
    ])} />);
    expect(screen.getByRole("heading", { name: /sábado 26\/09\/2026/i })).toBeInTheDocument();
    expect(screen.getByText(/20:50/)).toBeInTheDocument();
    expect(screen.getByText(/21:00/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /27\/09\/2026/ })).not.toBeInTheDocument();
  });
});
