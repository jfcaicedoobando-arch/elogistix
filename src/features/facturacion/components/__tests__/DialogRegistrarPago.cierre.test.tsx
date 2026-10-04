import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { clickFueraDelDialogo, esperarTickRadix } from "@/test/helpers/dialogOutsideClick";
import { DialogRegistrarPago } from "../DialogRegistrarPago";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), isPending: false, timbrandoRep: false }));
vi.mock("@/features/catalogos/hooks", () => ({ useExchangeRates: () => ({ data: { usdMxn: 20, eurMxn: 22 } }) }));
vi.mock("@/features/facturacion/hooks", () => ({ usePagosFactura: () => ({ data: [] }) }));
vi.mock("@/features/tesoreria/hooks", () => ({ useCuentasBancarias: () => ({ data: [] }) }));
vi.mock("@/features/facturacion/hooks/useSaldoFactura", () => ({
  useNotasCreditoAplicadas: () => ({ data: [] }), useSaldoFacturaServidor: () => ({ data: 116 }),
}));
vi.mock("@/features/facturacion/hooks/useRegistrarPagoSubmit", () => ({
  useRegistrarPagoSubmit: (onSuccess: () => void) => ({
    submit: (args: unknown) => { mocks.submit(args); onSuccess(); },
    isPending: mocks.isPending, timbrandoRep: mocks.timbrandoRep,
  }),
}));

const factura = { id: "factura-a4", numero: "A4", total: 116, moneda: "MXN", metodoPago: "PPD", estado: "Emitida" };

function montar() {
  const onClose = vi.fn();
  function Harness() {
    const [open, setOpen] = useState(true);
    return <TooltipProvider>
      <button type="button" onClick={() => setOpen(true)}>Reabrir</button>
      <DialogRegistrarPago open={open} factura={factura} onOpenChange={(v) => { onClose(v); setOpen(v); }} />
    </TooltipProvider>;
  }
  render(<Harness />);
  return onClose;
}

const rutas = ["Cancelar", "Escape", "X", "exterior"] as const;
async function solicitarCierre(ruta: typeof rutas[number]) {
  if (ruta === "Escape") {
    // El foco real queda en el campo capturado; un Hint abierto en la fecha
    // consume su propio Escape antes que el diálogo.
    const notas = screen.getByLabelText("Notas");
    act(() => notas.focus());
    await esperarTickRadix();
    fireEvent.keyDown(notas, { key: "Escape" });
  }
  else if (ruta === "exterior") { await esperarTickRadix(); clickFueraDelDialogo(); }
  else fireEvent.click(screen.getByRole("button", { name: ruta === "X" ? "Cerrar" : "Cancelar" }));
}

function capturar() {
  fireEvent.change(screen.getByLabelText("Monto del pago"), { target: { value: "55" } });
  fireEvent.change(screen.getByLabelText("Referencia"), { target: { value: "SPEI-55" } });
  fireEvent.change(screen.getByLabelText("Notas"), { target: { value: "Captura sin guardar" } });
}

beforeEach(() => { mocks.isPending = false; mocks.timbrandoRep = false; mocks.submit.mockClear(); });

describe("61: cierre de Registrar pago conserva captura hasta descartar", () => {
  it.each(rutas)("%s pide confirmación; continuar conserva datos y descartar cierra una vez", async (ruta) => {
    const onClose = montar();
    await waitFor(() => expect(screen.getByLabelText("Monto del pago")).toHaveValue("116"));
    capturar();
    await solicitarCierre(ruta);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    expect(screen.getByLabelText("Monto del pago")).toHaveValue("55");
    expect(screen.getByLabelText("Referencia")).toHaveValue("SPEI-55");
    expect(screen.getByLabelText("Notas")).toHaveValue("Captura sin guardar");
    await solicitarCierre(ruta);
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
    expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(screen.getByLabelText("Monto del pago")).toHaveValue("116"));
    expect(screen.getByLabelText("Referencia")).toHaveValue("");
    expect(screen.getByLabelText("Notas")).toHaveValue("");
  });

  it.each(rutas)("%s sin cambios cierra directamente", async (ruta) => {
    const onClose = montar();
    await waitFor(() => expect(screen.getByLabelText("Monto del pago")).toHaveValue("116"));
    await solicitarCierre(ruta);
    expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it.each(rutas)("%s no cierra durante un pago pendiente", async (ruta) => {
    mocks.isPending = true;
    const onClose = montar();
    await solicitarCierre(ruta);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("el éxito del guardado cierra una vez sin pedir descarte", async () => {
    const onClose = montar();
    await waitFor(() => expect(screen.getByLabelText("Monto del pago")).toHaveValue("116"));
    capturar();
    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
    expect(mocks.submit).toHaveBeenCalledOnce();
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ monto: 55, referencia: "SPEI-55", notas: "Captura sin guardar" }));
    expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
