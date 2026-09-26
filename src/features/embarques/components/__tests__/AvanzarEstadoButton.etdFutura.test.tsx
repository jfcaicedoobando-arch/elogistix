import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { formatDateOnlyLocal } from "@/lib/date/dateOnly";
import { AvanzarEstadoButton } from "../header/AvanzarEstadoButton";

function renderAvance(etd: string, siguienteEstado = "En Tránsito") {
  const onAvanzarEstado = vi.fn();
  render(
    <AvanzarEstadoButton
      estadoVisual="Confirmado"
      siguienteEstado={siguienteEstado}
      etd={etd}
      avanzandoEstado={false}
      bloqueadoPorDocs={false}
      docsFaltantes={[]}
      cierreBloqueadoPorChecklist={false}
      onAvanzarEstado={onAvanzarEstado}
      onIrACierre={vi.fn()}
      onIrADocumentos={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Avanzar a/i }));
  return onAvanzarEstado;
}

describe("AvanzarEstadoButton · ETD futura", () => {
  it("avisa del desfase sin impedir un zarpe temprano real", () => {
    const futura = new Date();
    futura.setDate(futura.getDate() + 5);
    const avanzar = renderAvance(formatDateOnlyLocal(futura));
    expect(screen.getByRole("note")).toHaveTextContent(/salida estimada.*fecha futura/i);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(avanzar).toHaveBeenCalledOnce();
  });

  it("no avisa si la ETD ya llegó", () => {
    const pasada = new Date();
    pasada.setDate(pasada.getDate() - 1);
    renderAvance(formatDateOnlyLocal(pasada));
    expect(screen.queryByRole("note")).toBeNull();
  });
});
