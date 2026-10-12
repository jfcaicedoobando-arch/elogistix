/** @vitest-environment jsdom */
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MonedaNotaCreditoProveedor } from "../../types";
import { DialogNotaCreditoProveedor } from "../DialogNotaCreditoProveedor";

const mocks = vi.hoisted(() => ({
  guardar: vi.fn(), adjuntos: vi.fn(), procesar: vi.fn(), cerrar: vi.fn(), error: vi.fn(),
  network: vi.fn(() => { throw new Error("Red no autorizada en regresión de captura"); }),
}));
vi.mock("@/features/cxp/hooks/useNotasCreditoProveedor", () => ({
  useCrearNotaCredito: () => ({ mutateAsync: mocks.guardar, isPending: false }),
}));
vi.mock("@/features/cxp/hooks/useNcProveedorTipoCambio", () => ({
  useNcProveedorTipoCambio: () => ({
    tipoCambio: null, disponible: true, fuente: null, fechaDof: null, aviso: null,
  }),
}));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => ({ organizationId: "org-fixture" }) }));
vi.mock("@/features/cxp/services", () => ({ subirArchivosNcProveedor: mocks.adjuntos }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: mocks.error }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.network, rpc: mocks.network, functions: { invoke: mocks.network } },
}));
// La sección XML real conserva la selección local; nunca procesa ni llama red.
vi.mock("@/features/cxp/hooks/useCargaCfdi", async () => {
  const { useState } = await import("react");
  return { useCargaCfdi: ({ onClear }: { onClear: () => void }) => {
    const [xml, setXml] = useState<File | null>(null);
    const [pdf, setPdfState] = useState<File | null>(null);
    const reset = () => { onClear(); setXml(null); setPdfState(null); };
    return {
      xml, pdf, loading: false, procesar: mocks.procesar, reset,
      handleXml: (file: File | null) => { if (!file) reset(); else { onClear(); setXml(file); } },
      setPdf: (file: File | null) => { onClear(); setPdfState(file); },
    };
  } };
});

function Harness({ monedaFactura = "MXN" }: { monedaFactura?: MonedaNotaCreditoProveedor }) {
  const [open, setOpen] = useState(true);
  return <>
    <button type="button" onClick={() => setOpen(true)}>Abrir nota</button>
    <DialogNotaCreditoProveedor open={open}
      onOpenChange={(next) => { mocks.cerrar(next); setOpen(next); }}
      facturaId="FP6-fixture" monedaFactura={monedaFactura} saldoFactura={100}
    />
  </>;
}
type Via = "Cancelar" | "X" | "Escape";
const vias: Via[] = ["Cancelar", "X", "Escape"];
function cerrar(via: Via) {
  if (via === "Escape") fireEvent.keyDown(document.body, { key: "Escape" });
  else fireEvent.click(screen.getByRole("button", { name: via === "X" ? "Cerrar" : "Cancelar" }));
}
async function elegir(indice: number, opcion: RegExp) {
  fireEvent.keyDown(screen.getAllByRole("combobox")[indice], { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: opcion }));
}
function comprobarDefaults(moneda: MonedaNotaCreditoProveedor = "MXN") {
  expect(screen.getByPlaceholderText("DD/MM/AAAA")).toHaveValue("12/10/2026");
  expect(screen.getAllByRole("combobox")[0]).toHaveTextContent(moneda);
  expect(screen.getAllByRole("combobox")[1]).toHaveTextContent(/Bonificaci/);
  expect(screen.getByLabelText("Folio NC *")).toHaveValue("");
  expect(screen.getByLabelText("Monto *")).toHaveDisplayValue("");
  expect(screen.getByLabelText("Base sin impuestos *")).toHaveDisplayValue("");
  expect(screen.getByLabelText(/Descripci/)).toHaveValue("");
  if (moneda !== "MXN") expect(screen.getByLabelText(/Tipo de cambio/)).toHaveValue("");
  expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
}
async function descartarReabrir(via: Via) {
  cerrar(via);
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Abrir nota" }));
}

const ediciones = [
  {
    campo: "fecha", monedaFactura: "MXN" as const,
    editar: async () => { fireEvent.change(screen.getByPlaceholderText("DD/MM/AAAA"), { target: { value: "11/10/2026" } }); },
    comprobar: () => expect(screen.getByPlaceholderText("DD/MM/AAAA")).toHaveValue("11/10/2026"),
    restaurar: async () => { fireEvent.change(screen.getByPlaceholderText("DD/MM/AAAA"), { target: { value: "12/10/2026" } }); },
  },
  {
    campo: "motivo", monedaFactura: "MXN" as const,
    editar: () => elegir(1, /^Descuento$/),
    comprobar: () => expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("Descuento"),
    restaurar: () => elegir(1, /^Bonificaci/),
  },
  {
    campo: "moneda", monedaFactura: "MXN" as const,
    editar: () => elegir(0, /^USD$/),
    comprobar: () => expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("USD"),
    restaurar: () => elegir(0, /^MXN/),
  },
  {
    campo: "tipo de cambio", monedaFactura: "USD" as const,
    editar: async () => { fireEvent.change(screen.getByLabelText(/Tipo de cambio/), { target: { value: "20" } }); },
    comprobar: () => expect(screen.getByLabelText(/Tipo de cambio/)).toHaveValue("20"),
    restaurar: async () => { fireEvent.change(screen.getByLabelText(/Tipo de cambio/), { target: { value: "" } }); },
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T18:00:00Z"));
  vi.stubGlobal("fetch", mocks.network);
});
afterEach(() => {
  expect(mocks.guardar).not.toHaveBeenCalled();
  expect(mocks.adjuntos).not.toHaveBeenCalled();
  expect(mocks.procesar).not.toHaveBeenCalled();
  expect(mocks.network).not.toHaveBeenCalled();
  expect(mocks.error).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("DialogNotaCreditoProveedor: snapshot completo por apertura", () => {
  it.each(ediciones.flatMap((edicion) => vias.map((via) => ({ ...edicion, via }))))(
    "$campo aislado con $via: continuar conserva y descartar reinicia defaults", async (caso) => {
      render(<Harness monedaFactura={caso.monedaFactura} />);
      comprobarDefaults(caso.monedaFactura);
      await caso.editar();
      for (let intento = 0; intento < 2; intento++) {
        cerrar(caso.via);
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
        caso.comprobar();
      }
      await descartarReabrir(caso.via);
      comprobarDefaults(caso.monedaFactura);
      expect(mocks.cerrar).toHaveBeenCalledExactlyOnceWith(false);
    },
  );

  it.each(ediciones)("restaurar $campo al snapshot vuelve a limpio", async (caso) => {
    render(<Harness monedaFactura={caso.monedaFactura} />);
    await caso.editar();
    await caso.restaurar();
    comprobarDefaults(caso.monedaFactura);
    cerrar("Cancelar");
    expect(mocks.cerrar).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it.each(["MXN", "USD", "EUR"] as const)("defaults y base vacía en %s no son dirty", (monedaFactura) => {
    render(<Harness monedaFactura={monedaFactura} />);
    comprobarDefaults(monedaFactura);
    cerrar("Cancelar");
    expect(mocks.cerrar).toHaveBeenCalledExactlyOnceWith(false);
  });

  const selecciones = ["sin adjuntos", "xml", "pdf", "xml y pdf"];
  it.each(selecciones.flatMap((seleccion) => vias.map((via) => ({ seleccion, via }))))(
    "modo XML $seleccion sin parsed con $via conserva selección y descarta limpio", async ({ seleccion, via }) => {
      render(<Harness />);
      fireEvent.click(screen.getByRole("button", { name: "Cargar XML CFDI" }));
      const xml = new File(["<fixture/>"], "captura.xml", { type: "application/xml" });
      const pdf = new File(["fixture"], "captura.pdf", { type: "application/pdf" });
      const xmlInput = document.querySelector<HTMLInputElement>('input[type="file"][accept*=".xml"]')!;
      const pdfInput = document.querySelector<HTMLInputElement>('input[type="file"][accept="application/pdf"]')!;
      if (seleccion.includes("xml")) fireEvent.change(xmlInput, { target: { files: [xml] } });
      if (seleccion.includes("pdf")) fireEvent.change(pdfInput, { target: { files: [pdf] } });
      cerrar(via);
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(mocks.cerrar).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
      if (seleccion.includes("xml")) expect(screen.getByText("captura.xml")).toBeInTheDocument();
      if (seleccion.includes("pdf")) expect(screen.getByRole("button", { name: "PDF: captura.pdf" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
      await descartarReabrir(via);
      comprobarDefaults();
      expect(screen.queryByText("captura.xml")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Cargar XML CFDI" }));
      expect(screen.getByRole("button", { name: "Adjuntar PDF (opcional)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Procesar XML" })).toBeDisabled();
    },
  );

  it("volver de XML vacío a manual restaura el snapshot sin falso dirty", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Cargar XML CFDI" }));
    fireEvent.click(screen.getByRole("button", { name: "Captura manual" }));
    cerrar("Cancelar");
    expect(mocks.cerrar).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("una reapertura usa monedaFactura vigente en sus defaults", () => {
    const view = render(<Harness />);
    cerrar("Cancelar");
    view.rerender(<Harness monedaFactura="EUR" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir nota" }));
    comprobarDefaults("EUR");
    cerrar("X");
    expect(mocks.cerrar).toHaveBeenCalledTimes(2);
  });

  it("la fecha de apertura no produce falso dirty al avanzar el día", () => {
    const view = render(<Harness />);
    vi.setSystemTime(new Date("2026-10-13T18:00:00Z"));
    view.rerender(<Harness />);
    expect(screen.getByPlaceholderText("DD/MM/AAAA")).toHaveValue("12/10/2026");
    cerrar("Cancelar");
    expect(mocks.cerrar).toHaveBeenCalledExactlyOnceWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Abrir nota" }));
    expect(screen.getByPlaceholderText("DD/MM/AAAA")).toHaveValue("13/10/2026");
    cerrar("Cancelar");
    expect(mocks.cerrar).toHaveBeenCalledTimes(2);
  });
});
