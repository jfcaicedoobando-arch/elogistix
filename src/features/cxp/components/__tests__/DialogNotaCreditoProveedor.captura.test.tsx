/** @vitest-environment jsdom */
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DialogNotaCreditoProveedor } from "../DialogNotaCreditoProveedor";

// Formulario, shell y confirmación reales; las fronteras fiscales son inertes.
const mocks = vi.hoisted(() => ({
  guardar: vi.fn(), adjuntos: vi.fn(), cerrar: vi.fn(), error: vi.fn(),
  network: vi.fn(() => { throw new Error("Red no autorizada en prueba de captura"); }),
  isPending: false,
}));
vi.mock("@/features/cxp/hooks/useNotasCreditoProveedor", () => ({
  useCrearNotaCredito: () => ({ mutateAsync: mocks.guardar, isPending: mocks.isPending }),
}));
vi.mock("@/features/cxp/hooks/useNcProveedorTipoCambio", () => ({
  useNcProveedorTipoCambio: () => ({
    tipoCambio: null, disponible: true, fuente: null, fechaDof: null, aviso: null,
  }),
}));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => ({ organizationId: "org-fixture" }) }));
vi.mock("@/features/cxp/services", () => ({ subirArchivosNcProveedor: mocks.adjuntos }));
vi.mock("../CargaXmlNcSection", () => ({ CargaXmlNcSection: () => null }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: mocks.error }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.network, rpc: mocks.network, functions: { invoke: mocks.network } },
}));

function Harness() {
  const [open, setOpen] = useState(true);
  return <>
    <button type="button" onClick={() => setOpen(true)}>Abrir nota</button>
    <DialogNotaCreditoProveedor
      open={open}
      onOpenChange={(next) => { mocks.cerrar(next); setOpen(next); }}
      facturaId="FP6-fixture"
      monedaFactura="MXN"
      saldoFactura={100}
    />
  </>;
}

const campos = [
  { label: "Folio NC *", value: "AUD2-NC-FP6" },
  { label: "Monto *", value: "10" },
  { label: "Base sin impuestos *", value: "10" },
  { label: /Descripci/, value: "Captura pendiente FP6" },
];
function llenar() {
  for (const campo of campos) fireEvent.change(screen.getByLabelText(campo.label), { target: { value: campo.value } });
}
function comprobarCaptura() {
  for (const campo of campos) expect(screen.getByLabelText(campo.label)).toHaveDisplayValue(campo.value);
  expect(screen.getByRole("button", { name: "Registrar" })).toBeEnabled();
}
function comprobarLimpia() {
  for (const campo of campos) expect(screen.getByLabelText(campo.label)).toHaveDisplayValue("");
  expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
}
const cierres = ["Cancelar", "X", "Escape"] as const;
function solicitarCierre(via: typeof cierres[number]) {
  if (via === "Escape") fireEvent.keyDown(document.body, { key: "Escape" });
  else fireEvent.click(screen.getByRole("button", { name: via === "X" ? "Cerrar" : "Cancelar" }));
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.isPending = false;
  mocks.guardar.mockImplementation(() => { throw new Error("No registrar NC en esta prueba"); });
  mocks.adjuntos.mockImplementation(() => { throw new Error("No subir adjuntos en esta prueba"); });
  vi.stubGlobal("fetch", mocks.network);
});
afterEach(() => {
  expect(mocks.guardar).not.toHaveBeenCalled();
  expect(mocks.adjuntos).not.toHaveBeenCalled();
  expect(mocks.network).not.toHaveBeenCalled();
  expect(mocks.error).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("DialogNotaCreditoProveedor: cierre protegido de captura AUD2", () => {
  it.each(cierres)("%s pide descarte, continuar repetidamente conserva y descartar limpia al reabrir", async (via) => {
    render(<Harness />);
    llenar();
    comprobarCaptura();
    for (let intento = 0; intento < 3; intento++) {
      solicitarCierre(via);
      expect(screen.getByRole("alertdialog")).toHaveTextContent(/Descartar los cambios/);
      expect(mocks.cerrar).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      comprobarCaptura();
    }
    solicitarCierre(via);
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.cerrar).toHaveBeenCalledExactlyOnceWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Abrir nota" }));
    comprobarLimpia();
    // Una nueva apertura admite la misma secuencia sin retener el descarte anterior.
    llenar();
    solicitarCierre(via);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir nota" }));
    comprobarLimpia();
    expect(mocks.cerrar).toHaveBeenCalledTimes(2);
  });

  it.each(cierres)("%s en una captura intacta cierra sin aviso y reabre limpia", async (via) => {
    render(<Harness />);
    comprobarLimpia();
    solicitarCierre(via);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.cerrar).toHaveBeenCalledExactlyOnceWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Abrir nota" }));
    comprobarLimpia();
  });

  it.each(campos)("Cancelar protege también la captura parcial de $label", async (campo) => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText(campo.label), { target: { value: campo.value } });
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
    solicitarCierre("Cancelar");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(mocks.cerrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    expect(screen.getByLabelText(campo.label)).toHaveDisplayValue(campo.value);
    solicitarCierre("Cancelar");
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Abrir nota" }));
    comprobarLimpia();
  });

  it.each(cierres)("%s no cierra ni descarta mientras el registro está pending", (via) => {
    const view = render(<Harness />);
    llenar();
    mocks.isPending = true;
    view.rerender(<Harness />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Guardando/ })).toBeDisabled();
    for (let intento = 0; intento < 3; intento++) solicitarCierre(via);
    expect(mocks.cerrar).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    mocks.isPending = false;
    view.rerender(<Harness />);
    comprobarCaptura();
    solicitarCierre(via);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    comprobarCaptura();
  });
});
