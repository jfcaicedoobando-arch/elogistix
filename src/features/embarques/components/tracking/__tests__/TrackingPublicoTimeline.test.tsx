/**
 * RUX-01 — la línea de tiempo pública nunca pinta eventos internos, semilla o E2E
 * (defensa en profundidad: la RPC ya los filtra en SQL).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrackingPublicoTimeline } from "../TrackingPublicoTimeline";

type Evento = Parameters<typeof TrackingPublicoTimeline>[0]["eventos"][number];

const eventos = [
  { tipo: "Zarpe", descripcion: "Salida de Shanghái", ubicacion: "CNSHA", fecha: "2026-08-01" },
  { tipo: "Otro", descripcion: "revisión interna de patio", ubicacion: null, fecha: "2026-08-02" },
  { tipo: "Arribo a Puerto", descripcion: "[interno] seed qa-01", ubicacion: null, fecha: "2026-08-03" },
] as unknown as Evento[];

describe("TrackingPublicoTimeline", () => {
  it("sólo muestra los hitos visibles al cliente", () => {
    render(<TrackingPublicoTimeline eventos={eventos} />);
    expect(screen.getByText("Salida de Shanghái")).toBeInTheDocument();
    expect(screen.queryByText("revisión interna de patio")).not.toBeInTheDocument();
    expect(screen.queryByText("[interno] seed qa-01")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío cuando todos los eventos son internos", () => {
    render(<TrackingPublicoTimeline eventos={[eventos[1], eventos[2]]} />);
    expect(screen.queryByText("revisión interna de patio")).not.toBeInTheDocument();
    expect(screen.getByText("Todavía no hay movimientos registrados")).toBeInTheDocument();
  });
});
