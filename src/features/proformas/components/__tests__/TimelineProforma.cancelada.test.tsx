import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TimelineProforma } from "../detalle/TimelineProforma";
import { resolveProformaTimelineFields } from "@/features/proformas/domain/proformaClienteEstado";
import type { ProformaDetalleFull } from "@/features/proformas/types";

function timeline(fields: Partial<ProformaDetalleFull> = {}) {
  return resolveProformaTimelineFields({
    estado_proforma: "cancelada", estado_cliente: "pendiente", ...fields,
  } as ProformaDetalleFull);
}

function hito(label: string) {
  const row = screen.getByText(label).closest("li");
  if (!row) throw new Error(`Hito no encontrado: ${label}`);
  return within(row);
}

describe("TimelineProforma cancelada", () => {
  it("cierra el ciclo sin presentar hitos ausentes como tareas pendientes ni inventar fecha", () => {
    render(<TimelineProforma fechaEmision="2026-10-01" operador={null} timeline={timeline()} />);
    expect(hito("Emitida").getByText("01/10/2026")).toBeTruthy();
    for (const label of ["Enviada al cliente", "Aceptada", "Facturada"]) {
      expect(hito(label).getByText("No realizado")).toBeTruthy();
    }
    expect(hito("Cancelada").getByText("Fecha no registrada")).toBeTruthy();
    expect(screen.queryByText("Pendiente")).toBeNull();
    expect(screen.queryByText("06/10/2026")).toBeNull();
  });

  it("conserva fechas, actores, envíos y facturación anteriores a cancelar", () => {
    render(<TimelineProforma fechaEmision="2026-10-01" operador="operador@example.test"
      timeline={timeline({
        estado_cliente: "aceptada", enviada_at: "2026-10-02", enviada_por: "envio@example.test",
        aceptada_at: "2026-10-03", aceptada_por: "cliente@example.test", fecha_facturacion: "2026-10-04",
      })} facturas={[{ estado: "Emitida" }]} envios={[
        { created_at: "2026-10-02", estado: "enviado", destinatarios: [] },
        { created_at: "2026-10-03", estado: "enviado", destinatarios: [] },
      ]} />);
    expect(hito("Enviada al cliente").getByText("02/10/2026")).toBeTruthy();
    expect(hito("Enviada al cliente").getByText("2 envíos · último 03/10/2026")).toBeTruthy();
    expect(hito("Aceptada").getByText("03/10/2026")).toBeTruthy();
    expect(hito("Aceptada").getByText("Cliente")).toBeTruthy();
    expect(hito("Facturada").getByText("04/10/2026")).toBeTruthy();
    expect(screen.queryByText("Pendiente")).toBeNull();
  });

  it.each(["aceptada", "rechazada"] as const)("conserva respuesta histórica %s sin atribuirle fecha", (estado_cliente) => {
    render(<TimelineProforma fechaEmision="2026-10-01" operador={null}
      timeline={timeline({ estado_cliente })} />);
    expect(hito(estado_cliente === "aceptada" ? "Aceptada" : "Rechazada").getByText("Fecha no registrada")).toBeTruthy();
  });

  it.each(["factura_id", "factura_secundaria_id"] as const)(
    "conserva conversión acreditada por %s sin afirmar emisión fiscal ni fecha",
    (key) => {
      render(<TimelineProforma fechaEmision="2026-10-01" operador={null}
        timeline={timeline({ [key]: "factura-historica" })} />);
      expect(hito("Convertida a factura").getByText("Fecha no registrada")).toBeTruthy();
      expect(screen.queryByText("Facturada")).toBeNull();
    },
  );

  it("conserva una conversión a borrador sin fecha y la aceptación previa al rechazo", () => {
    render(<TimelineProforma fechaEmision="2026-10-01" operador={null}
      timeline={timeline({ estado_cliente: "rechazada", aceptada_at: "2026-10-02", rechazada_at: "2026-10-03" })}
      facturas={[{ estado: "Borrador" }]} />);
    expect(hito("Aceptada").getByText("02/10/2026")).toBeTruthy();
    expect(hito("Rechazada").getByText("03/10/2026")).toBeTruthy();
    expect(hito("Convertida a borrador").getByText("Fecha no registrada")).toBeTruthy();
  });

  it("conserva aceptación persistida sin fecha y un rechazo fechado", () => {
    render(<TimelineProforma fechaEmision="2026-10-01" operador={null}
      timeline={timeline({ estado_cliente: "aceptada", rechazada_at: "2026-10-02" })} />);
    expect(hito("Aceptada").getByText("Fecha no registrada")).toBeTruthy();
    expect(hito("Rechazada").getByText("02/10/2026")).toBeTruthy();
  });

  it("conserva envío exitoso registrado sin fecha de cabecera", () => {
    render(<TimelineProforma fechaEmision="2026-10-01" operador={null} timeline={timeline()}
      envios={[{ created_at: "2026-10-02", estado: "enviado", destinatarios: [] }]} />);
    expect(hito("Enviada al cliente").getByText("Fecha no registrada")).toBeTruthy();
  });

  it("no acredita un envío fallido como enviado y conserva pendientes de una proforma vigente", () => {
    const { rerender } = render(<TimelineProforma fechaEmision="2026-10-01" operador={null} timeline={timeline()}
      envios={[{ created_at: "2026-10-02", estado: "fallido", destinatarios: [] }]} />);
    expect(hito("Enviada al cliente").getByText("No realizado")).toBeTruthy();
    rerender(<TimelineProforma fechaEmision="2026-10-01" operador={null}
      timeline={timeline({ estado_proforma: "pendiente" })} />);
    expect(screen.getAllByText("Pendiente")).toHaveLength(3);
    expect(screen.queryByText("Cancelada")).toBeNull();
  });
});
