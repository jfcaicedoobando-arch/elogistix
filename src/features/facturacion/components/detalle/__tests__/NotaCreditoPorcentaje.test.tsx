import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";
import { useNotaCreditoDraft } from "@/features/facturacion/hooks/useNotaCreditoDraft";
import { NotaCreditoAtajos } from "../NotaCreditoAtajos";
import { NotaCreditoResumen } from "../NotaCreditoResumen";

vi.mock("@/features/facturacion/hooks/useNotaCreditoSubmit", () => ({
  useNotaCreditoSubmit: () => ({ guardando: false, enviar: vi.fn() }),
}));

const original: ConceptoNotaCredito = {
  descripcion: "Servicio sin IVA",
  cantidad: 100,
  precio_unitario: 1,
  tipo_iva: "tasa_0",
  tasa_iva: 0,
};

function Vista({ conceptos = [original] }: { conceptos?: ConceptoNotaCredito[] }) {
  const draft = useNotaCreditoDraft({
    open: true,
    onOpenChange: () => {},
    facturaId: "factura-local",
    monedaFactura: "MXN",
    tipoCambioFactura: 1,
    saldoFactura: 1000,
    uuidFacturaOriginal: "uuid-local",
    conceptosSugeridos: conceptos,
  });
  return (
    <>
      <NotaCreditoAtajos
        saldoFactura={1000}
        monedaFactura="MXN"
        conceptosSugeridos={conceptos}
        onSaldoCompleto={draft.aplicarSaldoCompleto}
        onDescuento={draft.aplicarDescuento}
        onSeleccion={draft.aplicarSeleccion}
      />
      <NotaCreditoResumen
        totales={draft.totales}
        saldoFactura={1000}
        saldoRestante={draft.saldoRestante}
        monedaFactura="MXN"
        excedeSaldo={draft.excedeSaldo}
      />
    </>
  );
}

function aplicar(porcentaje: string) {
  fireEvent.change(screen.getByLabelText("Descuento %"), { target: { value: porcentaje } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
}

function esperarImporte(label: string, importe: string) {
  const fila = screen.getByText(label).parentElement;
  expect(fila).not.toBeNull();
  expect(within(fila!).getByText(importe)).toBeInTheDocument();
}

describe("Auditoría 107 · preview del porcentaje de nota de crédito", () => {
  it("muestra 50.50 para 100 × 1 al 50.5%, sin acumular al repetir ni cambiar porcentaje", () => {
    render(<Vista />);
    aplicar("50.5");
    esperarImporte("Subtotal", "MXN 50.50");
    esperarImporte("Total de la nota", "MXN 50.50");
    esperarImporte("Saldo después de la nota", "MXN 949.50");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    esperarImporte("Total de la nota", "MXN 50.50");
    aplicar("100");
    esperarImporte("Total de la nota", "MXN 100.00");
    aplicar("50.5");
    esperarImporte("Total de la nota", "MXN 50.50");
  });

  it("mantiene deshabilitado 0% y permite volver a un porcentaje válido", () => {
    render(<Vista />);
    aplicar("50.5");
    aplicar("0");
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
    esperarImporte("Total de la nota", "MXN 50.50");
    aplicar("100");
    esperarImporte("Total de la nota", "MXN 100.00");
  });

  it("conserva selección y tasa 8% al repetir un porcentaje fraccionario", () => {
    const gravado: ConceptoNotaCredito = { ...original, descripcion: "Servicio frontera", tipo_iva: "gravado_8", tasa_iva: 0.08 };
    render(<Vista conceptos={[original, gravado]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Acreditar Servicio sin IVA" }));
    aplicar("50.5");
    esperarImporte("Subtotal", "MXN 50.50");
    esperarImporte("IVA trasladado", "MXN 4.04");
    esperarImporte("Total de la nota", "MXN 54.54");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    esperarImporte("Total de la nota", "MXN 54.54");
    expect(screen.getByRole("checkbox", { name: "Acreditar Servicio sin IVA" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Acreditar Servicio frontera" })).toBeChecked();
  });

  it("usa la misma precisión con cantidad fraccionaria y en el empate de medio centavo", () => {
    render(<Vista conceptos={[{ ...original, cantidad: 0.5, precio_unitario: 0.1 }]} />);
    aplicar("70");
    esperarImporte("Subtotal", "MXN 0.04");
    esperarImporte("Total de la nota", "MXN 0.04");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    esperarImporte("Total de la nota", "MXN 0.04");
  });
});
