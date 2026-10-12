/** @vitest-environment jsdom */
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { clickFueraDelDialogo, esperarTickRadix } from "@/test/helpers/dialogOutsideClick";
import { DialogCobroLoteCliente } from "../DialogCobroLoteCliente";

const mocks = vi.hoisted(() => ({ pending: false, mutate: vi.fn(), rep: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/features/tesoreria/hooks", () => ({ useCuentasBancarias: () => ({ data: [] }) }));
vi.mock("@/features/facturacion/hooks/pagoClienteLoteHelpers", () => ({
  useIdsConRep: () => [], useTcLote: () => ({ tcDof: null, tcAplicable: null }),
}));
vi.mock("@/features/facturacion/hooks/usePagoClienteLote", () => ({
  usePagoClienteLote: () => ({ isPending: mocks.pending, mutateAsync: mocks.mutate }),
}));
vi.mock("@/features/facturacion/services/pagoClienteLote", async (original) => ({
  ...await original<typeof import("@/features/facturacion/services/pagoClienteLote")>(),
  obtenerFacturasConRep: mocks.rep,
}));

const facturas = [
  { factura_id: "a4", numero: "A4", saldo: 58, fecha_vencimiento: "2026-09-10" },
  { factura_id: "a6", numero: "A6", saldo: 215.5, fecha_vencimiento: "2026-09-11" },
];
const rutas = ["X", "Escape", "Cancelar", "exterior"] as const;

function montar() {
  const onClose = vi.fn();
  const onDone = vi.fn();
  function Harness() {
    const [open, setOpen] = useState(true);
    return <TooltipProvider>
      <button type="button" onClick={() => setOpen(true)}>Reabrir</button>
      <DialogCobroLoteCliente open={open} onOpenChange={(v) => { onClose(v); setOpen(v); }}
        clienteId="cliente-audit" clienteNombre="Cliente de prueba" moneda="MXN"
        facturas={facturas} onDone={onDone} />
    </TooltipProvider>;
  }
  const view = render(<Harness />);
  return { ...view, refresh: () => view.rerender(<Harness />), onClose, onDone };
}

async function cerrar(ruta: typeof rutas[number]) {
  if (ruta === "Escape") {
    const notas = screen.getByLabelText("Notas");
    act(() => notas.focus());
    await esperarTickRadix();
    fireEvent.keyDown(notas, { key: "Escape" });
  } else if (ruta === "exterior") {
    await esperarTickRadix();
    clickFueraDelDialogo();
  } else {
    fireEvent.click(screen.getByRole("button", { name: ruta === "X" ? "Cerrar" : "Cancelar" }));
  }
}

function capturar() {
  fireEvent.change(screen.getByLabelText("Referencia bancaria"), { target: { value: "AUD2-LOTE-0310" } });
  fireEvent.change(screen.getByLabelText("Notas"), { target: { value: "Captura pendiente" } });
}

beforeEach(() => {
  mocks.pending = false;
  mocks.mutate.mockReset().mockResolvedValue(undefined);
  mocks.rep.mockReset().mockResolvedValue([]);
});

describe("AUD2: cobro en lote protege la captura", () => {
  it.each(rutas)("%s conserva al continuar y sólo limpia al descartar", async (ruta) => {
    const { onClose, onDone } = montar();
    const importeInicial = Number((screen.getByLabelText("Importe recibido") as HTMLInputElement).value);
    expect(importeInicial).toBe(273.5);
    expect(screen.getByText("A4")).toBeInTheDocument();
    expect(screen.getByText("A6")).toBeInTheDocument();
    capturar();
    for (let intento = 0; intento < 3; intento++) {
      await cerrar(ruta);
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
      expect(screen.getByLabelText("Referencia bancaria")).toHaveValue("AUD2-LOTE-0310");
      expect(screen.getByLabelText("Notas")).toHaveValue("Captura pendiente");
      expect(Number((screen.getByLabelText("Importe recibido") as HTMLInputElement).value)).toBe(importeInicial);
    }
    await cerrar(ruta);
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    expect(screen.getByLabelText("Referencia bancaria")).toHaveValue("");
    expect(screen.getByLabelText("Notas")).toHaveValue("");
    expect(Number((screen.getByLabelText("Importe recibido") as HTMLInputElement).value)).toBe(importeInicial);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.rep).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it.each(rutas)("%s sin cambios cierra directamente pese al FIFO precargado", async (ruta) => {
    const { onClose } = montar();
    await cerrar(ruta);
    expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it.each(rutas)("%s bloquea cierre y edición mientras la mutación está pendiente", async (ruta) => {
    mocks.pending = true;
    const { onClose } = montar();
    await cerrar(ruta);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("Referencia bancaria")).toBeDisabled();
    expect(screen.getByLabelText("Notas")).toBeDisabled();
    expect(screen.getByLabelText("Importe aplicado a la factura A4")).toBeDisabled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("bloquea cierre desde la espera previa, recupera captura si falla y permite descartar", async () => {
    let rechazar!: (error: Error) => void;
    mocks.rep.mockImplementationOnce(() => new Promise((_, reject) => { rechazar = reject; }));
    const { onClose, onDone } = montar();
    capturar();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar cobro en lote" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    for (const ruta of rutas) await cerrar(ruta);
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
    await act(async () => { rechazar(new Error("Fallo simulado")); });
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "false"));
    expect(screen.getByLabelText("Referencia bancaria")).toHaveValue("AUD2-LOTE-0310");
    expect(screen.getByLabelText("Notas")).toHaveValue("Captura pendiente");
    await cerrar("Cancelar");
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("restaurar referencia y notas al valor inicial permite cerrar sin descarte", async () => {
    const { onClose } = montar();
    capturar();
    fireEvent.change(screen.getByLabelText("Referencia bancaria"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Notas"), { target: { value: "" } });
    await cerrar("Cancelar");
    expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("no descarta una confirmación ya abierta si el estado pasa a busy", async () => {
    const { onClose, refresh } = montar();
    capturar();
    await cerrar("X");
    mocks.pending = true;
    refresh();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    mocks.pending = false;
    refresh();
    expect(screen.getByLabelText("Referencia bancaria")).toHaveValue("AUD2-LOTE-0310");
    await cerrar("Cancelar");
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("el éxito simulado cierra una vez sin descarte y mantiene el payload del cobro", async () => {
    const { onClose, onDone } = montar();
    capturar();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar cobro en lote" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledExactlyOnceWith(false));
    expect(onDone).toHaveBeenCalledOnce();
    expect(mocks.mutate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      cliente_id: "cliente-audit", importe_recibido: 273.5, moneda: "MXN",
      referencia: "AUD2-LOTE-0310", notas: "Captura pendiente",
      renglones: [{ factura_id: "a4", monto: 58 }, { factura_id: "a6", monto: 215.5 }],
    }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
