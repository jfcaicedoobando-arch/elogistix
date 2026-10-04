import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { useTraspasoForm } from "@/features/tesoreria/hooks/useTraspasoForm";
import { TraspasoImportes } from "../TraspasoImportes";

vi.mock("@/features/catalogos/hooks/useTcDofPorFecha", () => ({ useTcDofPorFecha: () => ({ data: null }) }));
const cuenta = (id: string): Tables<"cuentas_bancarias"> => ({
  id, organization_id: "org", alias: id, banco: "Banco", moneda: "MXN", activa: true,
  saldo_inicial: 966.13, fecha_saldo_inicial: "2026-10-03", numero_cuenta: "", clabe: "", notas: "",
  created_at: "2026-10-03T00:00:00Z", updated_at: "2026-10-03T00:00:00Z", deleted_at: null, deleted_by: null,
});
const cuentas = [cuenta("origen"), cuenta("destino")];
const registrar = vi.fn();
function Harness() {
  const f = useTraspasoForm(true, cuentas);
  return <form onSubmit={(e) => { e.preventDefault(); if (!f.error) registrar(f.state); }}>
    <button type="button" onClick={() => { f.setField("origenId", "origen"); f.setField("destinoId", "destino"); f.setField("montoOrigen", 100); }}>Preparar cuentas</button>
    <TraspasoImportes fecha={f.state.fecha} montoOrigen={f.state.montoOrigen} comision={f.state.comision}
      monedaOrigen="MXN" onFechaChange={(v) => f.setField("fecha", v)} onMontoChange={(v) => f.setField("montoOrigen", v)}
      onComisionChange={(v) => f.setField("comision", v)} onCaptura={f.revisarCaptura} capturasNegativas={f.capturasNegativas} />
    <button disabled={!!f.error}>Registrar</button>
    <output aria-label="Importe">{f.state.montoOrigen}</output>
  </form>;
}
function renderHarness() {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Preparar cuentas" }));
}

function pegar(input: HTMLInputElement, raw: string) {
  input.setSelectionRange(0, input.value.length);
  fireEvent.paste(input, { clipboardData: { getData: () => raw } });
  fireEvent.input(input, { target: { value: raw }, inputType: "insertFromPaste" });
}
function escribir(input: HTMLInputElement, texto: string) {
  fireEvent.focus(input);
  fireEvent.input(input, { target: { value: "" }, inputType: "deleteContentBackward" });
  for (const letra of texto) fireEvent.input(input, { target: { value: input.value + letra }, inputType: "insertText" });
  fireEvent.blur(input);
}

describe("Traspaso: negativos explícitos sin invertir el signo", () => {
  it("teclear monto y comisión válidos conserva el importe y permite corregir un negativo", () => {
    registrar.mockClear();
    renderHarness();
    const monto = screen.getByLabelText("Monto a transferir") as HTMLInputElement;
    const comision = screen.getByLabelText("Comisión bancaria (opcional)") as HTMLInputElement;
    escribir(monto, "1000"); escribir(comision, "25");
    expect(monto).toHaveValue("1,000.00");
    expect(comision).toHaveValue("25.00");
    expect(screen.getByLabelText("Importe")).toHaveTextContent("1000");
    expect(screen.getByRole("button", { name: "Registrar" })).toBeEnabled();
    escribir(monto, "-25.50");
    expect(monto).toHaveValue("-25.50");
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
    escribir(monto, "25.50");
    expect(monto).toHaveValue("25.50");
    expect(screen.getByRole("button", { name: "Registrar" })).toBeEnabled();
    expect(registrar).not.toHaveBeenCalled();
  });
  it.each(["-25", "-25.50", "-25,50", "-", "$-25", "−25", "(25)"])("rechaza %s pegado y mantiene el error tras blur", (raw) => {
    registrar.mockClear();
    renderHarness();
    const input = screen.getByLabelText("Monto a transferir") as HTMLInputElement;
    pegar(input, raw); fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Corrige el monto negativo");
    fireEvent.submit(input.closest("form")!);
    expect(registrar).not.toHaveBeenCalled();
  });

  it("teclear signo y dígitos conserva el negativo hasta corregirlo", () => {
    renderHarness();
    const input = screen.getByLabelText("Monto a transferir") as HTMLInputElement;
    for (const raw of ["-", "-2", "-25", "-25.5"]) fireEvent.input(input, { target: { value: raw }, inputType: "insertText" });
    fireEvent.blur(input);
    expect(input).toHaveValue("-25.50");
    expect(screen.getByLabelText("Importe")).toHaveTextContent("-25.5");
    pegar(input, "25,50"); fireEvent.blur(input);
    expect(input).toHaveValue("25.50");
    expect(screen.getByRole("button", { name: "Registrar" })).toBeEnabled();
  });

  it("signo aislado de comisión no se acepta como cero confirmado", () => {
    renderHarness();
    const input = screen.getByLabelText("Comisión bancaria (opcional)") as HTMLInputElement;
    pegar(input, "-"); fireEvent.blur(input);
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
    pegar(input, "0"); fireEvent.blur(input);
    expect(screen.getByRole("button", { name: "Registrar" })).toBeEnabled();
  });
});
