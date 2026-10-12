import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerDirtyHistoryGuard } from "@/lib/bootstrap/dirtyHistoryGuard";
import { DialogNuevaFacturaProveedor } from "../DialogNuevaFacturaProveedor";
import type { CapturaPasos } from "@/features/cxp/hooks/useCapturaFacturaPasos";
import type { FacturaFormValues } from "@/features/cxp/types";

const state = vi.hoisted(() => ({ reset: vi.fn(), close: vi.fn(), submit: vi.fn(), io: vi.fn() }));

// Local state only: every service and fiscal action is inert and unexpected I/O fails.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => { throw new Error("Unexpected database access"); },
    rpc: () => { throw new Error("Unexpected RPC access"); } },
}));
vi.mock("@/features/cxp/services/facturasEntrantes", () => ({ abrirFacturaEntrante: state.io }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: state.io }));
vi.mock("@/features/presupuesto/hooks", () => ({ usePresupuestoCategorias: () => ({ data: [] }) }));
vi.mock("@/hooks/shared", () => ({ usePermissions: () => ({ canCapturarFacturaProveedor: true }) }));
vi.mock("@/features/cxp/hooks", () => ({ useNuevaFacturaProveedorForm: () => useFixtureForm() }));
vi.mock("@/features/cxp/hooks/useCapturaEntranteWiring", () => ({
  useCapturaEntranteWiring: () => ({ onDone: state.io, embarqueInicial: null,
    facturaIdPendiente: null, reintentar: state.io }),
}));
vi.mock("@/features/cxp/hooks/useModoBuzonWiring", () => ({
  useModoBuzonWiring: () => ({ autocarga: null, categoriaCogs: null, herencia: null }),
}));
vi.mock("@/features/cxp/hooks/useCuadreCaptura", () => ({
  useCuadreCaptura: () => ({ conceptosParaCuadre: [], cuadre: null,
    keyRenglonSospechoso: null, ivaPartidas: 0 }),
}));
vi.mock("../TotalesChipDesglose", () => ({ TotalesChipDesglose: () => null }));
vi.mock("../CuadreConceptosBar", () => ({ CuadreConceptosBar: () => null }));
vi.mock("../_sections/CapturaFacturaPasosBody", () => ({
  CapturaFacturaPasosBody: ({ ctl, pasos }: { ctl: ReturnType<typeof useFixtureForm>; pasos: CapturaPasos }) => (
    <>
      <p>Paso actual: {pasos.paso}</p>
      <p>Conceptos capturados: {ctl.conceptosManuales.conceptos.length}</p>
      <p>Concepto capturado: {ctl.conceptosManuales.conceptos[0]?.descripcion ?? ""}</p>
      <button onClick={() => ctl.setPending(!ctl.isPending)}>Simular operación pendiente</button>
      {pasos.paso === 1 ? (
        <input aria-label="Concepto de factura" value={ctl.conceptosManuales.conceptos[0]?.descripcion ?? ""}
          onChange={(event) => ctl.capturarConcepto(event.target.value)} />
      ) : (
        <input aria-label="Folio del proveedor" value={ctl.values.folio}
          onChange={(event) => ctl.setFolio(event.target.value)} />
      )}
    </>
  ),
}));

function emptyValues(): FacturaFormValues {
  return { provId: "", provNombre: "", folio: "", emision: "2026-10-12", diasCredito: 0,
    vencimiento: "2026-10-12", moneda: "MXN", tc: "", subtotal: "0", iva: "0", ieps: "0",
    retenciones: "0", categoriaId: "", notas: "" };
}

function useFixtureForm() {
  const [values, setValues] = useState(emptyValues);
  const [conceptos, setConceptos] = useState<Array<{ descripcion: string; importe: number; cantidad: number }>>([]);
  const [isPending, setPending] = useState(false);
  return {
    values, total: 0, isPending, setPending, puedeGuardar: false, cfdiConceptos: [],
    cfdiDuplicado: null, vinculos: {}, topeVinculacion: { excede: false },
    conceptosManuales: { conceptos }, validate: () => true, submit: state.submit,
    setFolio: (folio: string) => setValues((current) => ({ ...current, folio })),
    capturarConcepto: (descripcion: string) => setConceptos([{ descripcion, importe: 0, cantidad: 1 }]),
    reset: () => { state.reset(); setValues(emptyValues()); setConceptos([]); },
  };
}

function Compras() {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>Capturar factura</button>
    <DialogNuevaFacturaProveedor open={open} onOpenChange={(next) => { state.close(next); setOpen(next); }} />
  </>;
}

// Match main.tsx: install the dispatcher before BrowserRouter's listener.
registerDirtyHistoryGuard();

afterEach(() => {
  expect(state.submit).not.toHaveBeenCalled();
  expect(state.io).not.toHaveBeenCalled();
});

async function mountCaptura(direction: "back" | "forward" = "back") {
  window.history.replaceState({ idx: 0 }, "", "/proformas");
  window.history.pushState({ idx: 1 }, "", "/compras");
  if (direction === "forward") {
    window.history.pushState({ idx: 2 }, "", "/siguiente");
    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe("/compras"));
  }
  render(<BrowserRouter><Routes>
    <Route path="/proformas" element={<p>Proformas anterior</p>} />
    <Route path="/compras" element={<Compras />} />
    <Route path="/siguiente" element={<p>Página siguiente</p>} />
  </Routes></BrowserRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Capturar factura" }));
}

function captureStepTwo() {
  fireEvent.change(screen.getByRole("textbox", { name: "Concepto de factura" }), {
    target: { value: "Concepto AUD2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Folio del proveedor" }), {
    target: { value: "AUD2-UX-BACK-0310" },
  });
}

function expectPreserved() {
  expect(window.location.pathname).toBe("/compras");
  expect(screen.getByText("Paso actual: 2")).toBeInTheDocument();
  expect(screen.getByText("Conceptos capturados: 1")).toBeInTheDocument();
  expect(screen.getByText("Concepto capturado: Concepto AUD2")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Folio del proveedor" })).toHaveValue("AUD2-UX-BACK-0310");
  expect(state.reset).not.toHaveBeenCalled();
  expect(state.close).not.toHaveBeenCalled();
}

async function interrupt(direction: "back" | "forward") {
  act(() => window.history[direction]());
  await waitFor(() => expect(screen.getByRole("alertdialog", { name: "¿Salir sin guardar?" })).toBeInTheDocument());
  expect(window.location.pathname).toBe("/compras");
  expect(window.history.state.idx).toBe(1);
}

async function continueCapturing() {
  fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
  await waitFor(() => expect(screen.queryAllByRole("alertdialog", { hidden: true })).toHaveLength(0));
  expectPreserved();
}

function requestShellClose(exit: "X" | "Escape" | "Cancelar") {
  if (exit === "Escape") {
    fireEvent.keyDown(document.body, { key: "Escape" });
    return;
  }
  // Also exercise requests on the parent hidden by a navigation confirmation.
  const captureDialog = screen.getByRole("dialog", { hidden: true });
  const button = within(captureDialog).getByText(exit === "X" ? "Cerrar" : "Cancelar").closest("button");
  expect(button).not.toBeNull();
  fireEvent.click(button!);
}

async function expectSingleNavigationAlert() {
  await waitFor(() => expect(screen.getAllByRole("alertdialog", { hidden: true })).toHaveLength(1));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("¿Salir sin guardar?");
  expect(screen.queryByText("¿Descartar los cambios?")).not.toBeInTheDocument();
}

async function confirmAndReopenClean(direction: "back" | "forward", historyLength: number) {
  fireEvent.click(screen.getByRole("button", { name: "Salir sin guardar" }));
  const target = direction === "back" ? "/proformas" : "/siguiente";
  await waitFor(() => expect(window.location.pathname).toBe(target));
  expect(screen.getByText(direction === "back" ? "Proformas anterior" : "Página siguiente")).toBeInTheDocument();
  expect(window.history.state.idx).toBe(direction === "back" ? 0 : 2);
  expect(window.history.length).toBe(historyLength);
  expect(state.reset).not.toHaveBeenCalled();
  expect(state.close).not.toHaveBeenCalled();
  // A single opposite traversal reaches Compras; there is no double-back trap.
  act(() => window.history[direction === "back" ? "forward" : "back"]());
  await waitFor(() => expect(screen.getByRole("button", { name: "Capturar factura" })).toBeInTheDocument());
  expect(window.location.pathname).toBe("/compras");
  expect(window.history.state.idx).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Capturar factura" }));
  expect(screen.getByText("Paso actual: 1")).toBeInTheDocument();
  expect(screen.getByText("Conceptos capturados: 0")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Concepto de factura" })).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByRole("textbox", { name: "Folio del proveedor" })).toHaveValue("");
  act(() => window.history[direction]());
  await waitFor(() => expect(window.location.pathname).toBe(target));
  expect(screen.queryAllByRole("alertdialog", { hidden: true })).toHaveLength(0);
  expect(window.history.length).toBe(historyLength);
}

describe("factura proveedor: Atrás y Adelante con captura", () => {
  it.each([
    ["back", "X"], ["back", "Escape"], ["back", "Cancelar"],
    ["forward", "X"], ["forward", "Escape"], ["forward", "Cancelar"],
  ] as const)("%s: %s con aviso de historial activo no abre una segunda alerta", async (direction, exit) => {
    await mountCaptura(direction);
    captureStepTwo();
    const historyLength = window.history.length;
    await interrupt(direction);
    requestShellClose(exit);
    expect(screen.queryAllByRole("alertdialog", { hidden: true }).length).toBeLessThanOrEqual(1);
    if (screen.queryByRole("alertdialog")) await continueCapturing();
    else expectPreserved();
    await interrupt(direction);
    await confirmAndReopenClean(direction, historyLength);
  });

  it.each([
    ["back", "X"], ["back", "Escape"], ["back", "Cancelar"],
    ["forward", "X"], ["forward", "Escape"], ["forward", "Cancelar"],
  ] as const)("descarte previo %s tras %s: historial toma prioridad y continuar conserva todo", async (direction, exit) => {
    await mountCaptura(direction);
    captureStepTwo();
    const historyLength = window.history.length;
    requestShellClose(exit);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("¿Descartar los cambios?");
    await interrupt(direction);
    await expectSingleNavigationAlert();
    await continueCapturing();
    expect(window.history.length).toBe(historyLength);
    // A new request is guarded after the first one was interrupted.
    requestShellClose(exit);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("¿Descartar los cambios?");
    await interrupt(direction);
    await expectSingleNavigationAlert();
    await confirmAndReopenClean(direction, historyLength);
  });

  it.each(["back", "forward"] as const)("descarte previo %s: la acción vieja oculta no resetea ni cierra", async (direction) => {
    await mountCaptura(direction);
    captureStepTwo();
    const historyLength = window.history.length;
    requestShellClose("X");
    const oldDiscard = screen.getByRole("button", { name: "Descartar" });
    await interrupt(direction);
    // Retain the DOM reference to the superseded confirmation: r1 leaves it
    // mounted and actionable underneath the navigation alert.
    fireEvent.click(oldDiscard);
    expect(state.reset).not.toHaveBeenCalled();
    expect(state.close).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/compras");
    await expectSingleNavigationAlert();
    await continueCapturing();
    await interrupt(direction);
    await confirmAndReopenClean(direction, historyLength);
  });

  it.each(["back", "forward"] as const)("descarte previo %s: primer POP bloquea la acción vieja antes del render", async (direction) => {
    await mountCaptura(direction);
    captureStepTwo();
    const historyLength = window.history.length;
    requestShellClose("Cancelar");
    const oldDiscard = screen.getByRole("button", { name: "Descartar" });
    const originalGo = window.history.go.bind(window.history);
    let injected = false;
    const historyGo = vi.spyOn(window.history, "go").mockImplementation((delta) => {
      if (!injected && delta === (direction === "back" ? 1 : -1)) {
        injected = true;
        // onPopState has started restoration, but the new React confirmation
        // is not rendered yet. This still-connected action must already be blocked.
        expect(oldDiscard).toBeInTheDocument();
        fireEvent.click(oldDiscard);
      }
      originalGo(delta);
    });
    try {
      act(() => window.history[direction]());
      await waitFor(() => expect(injected).toBe(true));
      expect(state.reset).not.toHaveBeenCalled();
      expect(state.close).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByRole("alertdialog", { name: "¿Salir sin guardar?" })).toBeInTheDocument());
      expect(window.location.pathname).toBe("/compras");
      expect(window.history.state.idx).toBe(1);
      await expectSingleNavigationAlert();
      await continueCapturing();
      await interrupt(direction);
      await confirmAndReopenClean(direction, historyLength);
    } finally {
      historyGo.mockRestore();
    }
  });

  it("una operación pendiente bloquea X, Escape y Cancelar sin perder datos", async () => {
    await mountCaptura();
    captureStepTwo();
    fireEvent.click(screen.getByRole("button", { name: "Simular operación pendiente" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expectPreserved();
    fireEvent.click(screen.getByRole("button", { name: "Simular operación pendiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("¿Descartar los cambios?");
    await continueCapturing();
  });

  it.each(["back", "forward"] as const)("protege %s repetido; confirmar sale una vez y volver reabre limpio", async (direction) => {
    await mountCaptura(direction);
    captureStepTwo();
    const historyLength = window.history.length;
    for (let attempt = 0; attempt < 3; attempt++) {
      await interrupt(direction);
      await continueCapturing();
      expect(window.history.length).toBe(historyLength);
    }
    // The concept itself survives, not only the number of rows.
    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByRole("textbox", { name: "Concepto de factura" })).toHaveValue("Concepto AUD2");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await interrupt(direction);
    fireEvent.click(screen.getByRole("button", { name: "Salir sin guardar" }));
    const target = direction === "back" ? "/proformas" : "/siguiente";
    await waitFor(() => expect(window.location.pathname).toBe(target));
    expect(screen.getByText(direction === "back" ? "Proformas anterior" : "Página siguiente")).toBeInTheDocument();
    expect(window.history.length).toBe(historyLength);

    // One opposite traversal returns to Compras; the guard left no extra entries.
    act(() => window.history[direction === "back" ? "forward" : "back"]());
    await waitFor(() => expect(screen.getByRole("button", { name: "Capturar factura" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Capturar factura" }));
    expect(screen.getByText("Paso actual: 1")).toBeInTheDocument();
    expect(screen.getByText("Conceptos capturados: 0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("textbox", { name: "Folio del proveedor" })).toHaveValue("");
    act(() => window.history[direction]());
    await waitFor(() => expect(window.location.pathname).toBe(target));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it.each([
    ["back", "X"], ["back", "Escape"], ["back", "Cancelar"],
    ["forward", "X"], ["forward", "Escape"], ["forward", "Cancelar"],
  ] as const)("%s: %s sigue protegido después de interrumpir historial y descarta una sola vez", async (direction, exit) => {
    await mountCaptura(direction);
    captureStepTwo();
    await interrupt(direction);
    await continueCapturing();
    requestShellClose(exit);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("¿Descartar los cambios?");
    await continueCapturing();
    requestShellClose(exit);
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(state.reset).toHaveBeenCalledTimes(1);
    expect(state.close).toHaveBeenCalledExactlyOnceWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Capturar factura" }));
    expect(screen.getByText("Paso actual: 1")).toBeInTheDocument();
    expect(screen.getByText("Conceptos capturados: 0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("textbox", { name: "Folio del proveedor" })).toHaveValue("");
    act(() => window.history[direction]());
    await waitFor(() => expect(window.location.pathname).toBe(direction === "back" ? "/proformas" : "/siguiente"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("sin captura, Atrás no pide confirmación ni añade entradas", async () => {
    await mountCaptura();
    const historyLength = window.history.length;
    act(() => window.history.back());
    await waitFor(() => expect(screen.getByText("Proformas anterior")).toBeInTheDocument());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(window.history.length).toBe(historyLength);
  });
});
