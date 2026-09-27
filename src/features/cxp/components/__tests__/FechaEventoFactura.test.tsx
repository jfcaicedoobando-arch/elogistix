import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { formatDateTimeShort } from "@/lib/formatters";
import { FechaEventoFactura } from "../FechaEventoFactura";
import type { EventoHistorialFactura } from "@/features/cxp/services/historialFactura";

const evento: EventoHistorialFactura = {
  tipo: "pago", ts: "2026-09-27T02:00:00Z", descripcion: "Pago registrado",
  actor_email: "contador@chino.com", monto: 300, moneda: "MXN",
  detalles: { fecha_pago: "2026-09-26" },
};

describe("FechaEventoFactura", () => {
  it("conserva el día capturado y muestra aparte el instante de registro", () => {
    render(<FechaEventoFactura ev={evento} />);
    expect(screen.getByText("Fecha de pago: 26/09/2026")).toBeVisible();
    expect(screen.getByText(`Registrado: ${formatDateTimeShort(evento.ts)}`)).toBeVisible();
  });
  it("un pago retroactivo no se presenta con el día en que se capturó", () => {
    render(<FechaEventoFactura ev={{ ...evento, detalles: { fecha_pago: "2026-09-20" } }} />);
    expect(screen.getByText("Fecha de pago: 20/09/2026")).toBeVisible();
    expect(screen.getByText(`Registrado: ${formatDateTimeShort(evento.ts)}`)).toBeVisible();
  });
  it.each([{}, { fecha_pago: null }, { fecha_pago: "incorrecta" }])("no deduce una fecha del timestamp legacy (%j)", (detalles) => {
    render(<FechaEventoFactura ev={{ ...evento, detalles }} />);
    expect(screen.getByText("Fecha de pago no disponible")).toBeVisible();
    expect(screen.queryByText(/Registrado:/)).not.toBeInTheDocument();
  });
  it("conserva la fecha/hora de los eventos que no son pagos", () => {
    render(<FechaEventoFactura ev={{ ...evento, tipo: "creada" }} />);
    expect(screen.getByText(formatDateTimeShort(evento.ts))).toBeVisible();
    expect(screen.queryByText(/Fecha de pago:/)).not.toBeInTheDocument();
  });
});
