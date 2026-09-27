import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConceptoLineaRow } from "../ConceptoLineaRow";

describe("concepto manual con IEPS · AUD-F02", () => {
  it("captura IEPS y calcula IVA sobre subtotal más IEPS", () => {
    const onActualizar = vi.fn();
    render(<TooltipProvider><ConceptoLineaRow moneda="MXN" onActualizar={onActualizar} onEliminar={vi.fn()}
      concepto={{ key: "c1", descripcion: "Servicio", cantidad: 2, importe: 500, iva: 0, ieps: 80 }} /></TooltipProvider>);
    expect(screen.getByLabelText("IEPS del concepto")).toHaveValue("80.00");
    fireEvent.click(screen.getByLabelText("Aplicar IVA 16% a esta línea"));
    expect(onActualizar).toHaveBeenCalledWith("c1", "iva", 172.8);
    expect(screen.getByLabelText("IVA del concepto")).toHaveValue("172.80");
    fireEvent.change(screen.getByLabelText("IEPS del concepto"), { target: { value: "100" } });
    fireEvent.blur(screen.getByLabelText("IEPS del concepto"));
    expect(onActualizar).toHaveBeenCalledWith("c1", "ieps", 100);
    expect(screen.getByLabelText("IEPS del concepto")).toHaveValue("100.00");
  });
});
