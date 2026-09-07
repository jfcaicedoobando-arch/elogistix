/**
 * v13.823.191 — Al editar los conceptos de una factura de proveedor el subtotal
 * de referencia se deriva de los renglones (Σ importe × cantidad), no del
 * subtotal viejo de la cabecera.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

const conceptos = [
  { id: "c1", descripcion: "Flete", cantidad: 2, clave_unidad: "E48", monto: 1000, iva: 0, ieps: 0 },
  { id: "c2", descripcion: "Maniobras", cantidad: 1, clave_unidad: null, monto: 500, iva: 0, ieps: 0 },
];

vi.mock("@/features/cxp/hooks/useConceptosCfdiFactura", () => ({
  useConceptosCfdiFactura: () => ({ data: conceptos, isLoading: false }),
}));
vi.mock("@/features/cxp/hooks/useEditarConceptosFactura", () => ({
  useEditarConceptosFactura: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { DialogEditarConceptosFactura } = await import(
  "@/features/cxp/components/DialogEditarConceptosFactura"
);

function renderDialog(subtotal: number) {
  return render(
    <TooltipProvider>
      <DialogEditarConceptosFactura
      open
      onOpenChange={() => {}}
      facturaId="f1"
      folio="FP-000224"
      moneda="MXN"
        subtotal={subtotal}
      />
    </TooltipProvider>,
  );
}

describe("DialogEditarConceptosFactura · subtotal derivado", () => {
  it("muestra el subtotal que suman los renglones con cantidad mayor a 1", async () => {
    renderDialog(1500);
    // 1000 × 2 + 500 × 1 = 2500
    expect(await screen.findAllByText(/2,500\.00/)).not.toHaveLength(0);
    expect(screen.queryByText(/Faltan|Sobran/i)).not.toBeInTheDocument();
  });

  it("avisa del cambio de subtotal contra el valor anterior de la cabecera", async () => {
    renderDialog(1500);
    expect(
      await screen.findByText(/el subtotal de la factura cambia de/i),
    ).toBeInTheDocument();
  });

  it("no avisa cuando la cabecera ya coincide con los renglones", async () => {
    renderDialog(2500);
    expect(await screen.findAllByText(/2,500\.00/)).not.toHaveLength(0);
    expect(screen.queryByText(/el subtotal de la factura cambia de/i)).not.toBeInTheDocument();
  });
});
