import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode, FormEventHandler } from "react";
import type { Tables } from "@/integrations/supabase/types";
const registrar = vi.hoisted(() => vi.fn());
vi.mock("@/features/tesoreria/hooks/useTraspasos", () => ({
  useRegistrarTraspaso: () => ({ mutate: registrar, isPending: false }),
}));
vi.mock("@/features/catalogos/hooks/useTcDofPorFecha", () => ({ useTcDofPorFecha: () => ({ data: null }) }));
vi.mock("@/components/shared/FormDialogShell", () => ({
  FormDialogShell: ({ children, footer, onSubmit, open }: {
    children: ReactNode; footer: ReactNode; onSubmit: FormEventHandler; open: boolean;
  }) => open ? <form aria-label="Traspaso" onSubmit={onSubmit}>{children}{footer}</form> : null,
}));
vi.mock("@/components/shared/FormDialogFooter", () => ({
  FormDialogFooter: ({ disabled }: { disabled: boolean }) => <button type="submit" disabled={disabled}>Registrar traspaso</button>,
}));
vi.mock("../TraspasoCuentaSelect", () => ({
  TraspasoCuentaSelect: ({ label, value, onChange, cuentas }: {
    label: string; value: string; onChange: (v: string) => void; cuentas: Tables<"cuentas_bancarias">[];
  }) => <label>{label}<select value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">Selecciona</option>{cuentas.map((c) => <option key={c.id} value={c.id}>{c.alias}</option>)}
  </select></label>,
}));
vi.mock("../TraspasoConversion", () => ({ TraspasoConversion: () => <p>Previsualización del traspaso</p> }));
import { DialogTraspasoCuentas } from "../DialogTraspasoCuentas";

const cuenta = (id: string, corte: string): Tables<"cuentas_bancarias"> => ({
  id, organization_id: "org", alias: id, banco: "Banco", moneda: "MXN", activa: true,
  saldo_inicial: 1000, fecha_saldo_inicial: corte, numero_cuenta: "", clabe: "", notas: "",
  created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", deleted_at: null, deleted_by: null,
});
const cuentas = [cuenta("origen", "2026-10-01"), cuenta("destino", "2026-10-03"), cuenta("nueva", "2026-10-04")];
const props = { open: true, onOpenChange: vi.fn(), cuentas };
function preparar() {
  const rendered = render(<DialogTraspasoCuentas {...props} />);
  fireEvent.change(screen.getByLabelText("Cuenta origen"), { target: { value: "origen" } });
  fireEvent.change(screen.getByLabelText("Cuenta destino"), { target: { value: "destino" } });
  fireEvent.input(screen.getByLabelText("Monto transferido"), { target: { value: "20" } });
  return rendered;
}
function fecha(texto: string) {
  const input = screen.getByLabelText("Fecha");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: texto } });
  fireEvent.blur(input);
}
const confirmar = () => screen.getByRole("button", { name: "Registrar traspaso" });

describe("49 · traspaso antes del corte bloqueado en el formulario", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-04T18:00:00Z")); registrar.mockClear(); });
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); });
  it("muestra ambos cortes y la fecha mínima; una fecha anterior no previsualiza ni envía", () => {
    preparar();
    expect(screen.getByText("Corte de cuenta origen: 01/10/2026.")).toBeInTheDocument();
    expect(screen.getByText("Corte de cuenta destino: 03/10/2026.")).toBeInTheDocument();
    expect(screen.getByText("Fecha mínima permitida: 03/10/2026 (inclusive).")).toBeInTheDocument();
    fecha("02/10/2026");
    expect(confirmar()).toBeDisabled();
    expect(screen.getByLabelText("Fecha")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Previsualización del traspaso")).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole("form", { name: "Traspaso" }));
    fireEvent.submit(screen.getByRole("form", { name: "Traspaso" }));
    expect(registrar).not.toHaveBeenCalled();
    fecha("03/10/2026");
    expect(confirmar()).toBeEnabled();
    expect(screen.getByText("Previsualización del traspaso")).toBeInTheDocument();
    fireEvent.click(confirmar());
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ fecha: "2026-10-03", montoOrigen: 20 }), expect.anything());
  });
  it.each(["Cuenta origen", "Cuenta destino"])("revalida la fecha capturada al cambiar %s", (label) => {
    preparar(); fecha("03/10/2026");
    expect(confirmar()).toBeEnabled();
    fireEvent.change(screen.getByLabelText(label), { target: { value: "nueva" } });
    expect(confirmar()).toBeDisabled();
    expect(screen.getByText("Fecha mínima permitida: 04/10/2026 (inclusive).")).toBeInTheDocument();
    expect(screen.getAllByText(/igual o posterior al 04\/10\/2026/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Previsualización del traspaso")).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole("form", { name: "Traspaso" }));
    expect(registrar).not.toHaveBeenCalled();
    fecha("04/10/2026");
    expect(confirmar()).toBeEnabled();
  });
  it("revalida si una actualización de datos cambia el corte y al reabrir limpia la captura", () => {
    const rendered = preparar(); fecha("03/10/2026");
    rendered.rerender(<DialogTraspasoCuentas {...props} cuentas={[cuentas[0], { ...cuentas[1], fecha_saldo_inicial: "2026-10-04" }]} />);
    expect(confirmar()).toBeDisabled();
    rendered.rerender(<DialogTraspasoCuentas {...props} open={false} />);
    rendered.rerender(<DialogTraspasoCuentas {...props} />);
    expect(screen.getByLabelText("Cuenta origen")).toHaveValue("");
    expect(screen.getByLabelText("Fecha")).toHaveValue("04/10/2026");
    expect(confirmar()).toBeDisabled();
    expect(registrar).not.toHaveBeenCalled();
  });
});
