import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DialogCancelarRep } from "../DialogCancelarRep";
import { CancelarRepResultadoAlerts } from "../CancelarRepResultadoAlerts";

describe("Cancelación REP: alcance fiscal, cobro y banco", () => {
  it("explica los vínculos bancarios y conserva otros abonos antes de confirmar", () => {
    const onConfirm = vi.fn();
    render(<DialogCancelarRep open onOpenChange={vi.fn()} motivo="02" onMotivoChange={vi.fn()} onConfirm={onConfirm} isPending={false} resultado={null} pago={{ id: "pago", fecha_pago: "2026-10-05", monto: 580, moneda: "MXN", serie_rep: "REP", folio_rep: 12 }} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/recalculará el saldo.*conservando los demás abonos y créditos/);
    expect(dialog).toHaveTextContent(/generados.*se darán de baja.*importados.*pendientes de conciliación/);
    expect(dialog).toHaveTextContent("Esto no devuelve dinero en el banco");
    expect(dialog).not.toHaveTextContent(/factura quedará pendiente de cobro/);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelación" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("aceptada explica sólo la baja de su cobro, no que la factura esté completamente sin pagar", () => {
    render(<CancelarRepResultadoAlerts resultado="accepted" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/Se dio de baja su cobro.*recalculó el saldo/);
    expect(screen.getByRole("alert")).toHaveTextContent("conservando los demás abonos y créditos");
    expect(screen.getByRole("alert")).toHaveTextContent("no devuelve dinero en el banco");
  });

  it("aceptada con fallo local no anuncia que el cobro ya fue retirado", () => {
    render(<CancelarRepResultadoAlerts resultado="accepted_sync_failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/SAT aceptó.*no se pudo dar de baja/);
    expect(screen.getByRole("alert")).toHaveTextContent(/cancelación está confirmada.*completa su baja/);
  });

  it.each(["pending", "uncertain"] as const)("%s conserva el cobro y no afirma cancelación aceptada", (resultado) => {
    render(<CancelarRepResultadoAlerts resultado={resultado} />);
    expect(screen.getByRole("alert")).toHaveTextContent("El cobro se conserva en el ERP");
    expect(screen.getByRole("alert")).not.toHaveTextContent("REP cancelado");
    expect(screen.getByRole("alert")).toHaveTextContent("Actualizar estado");
    if (resultado === "uncertain") expect(screen.getByRole("alert")).toHaveTextContent("no se pudo confirmar");
  });

  it("error no anuncia aceptación ni baja local", () => {
    render(<CancelarRepResultadoAlerts resultado="error" />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo completar la cancelación");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Se dio de baja");
  });
});
