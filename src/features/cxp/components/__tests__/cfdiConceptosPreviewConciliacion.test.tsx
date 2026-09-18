/**
 * P2 · Auditoría IVA — la vista previa recibía sólo las líneas, así que no podía
 * conciliar retenciones ni avisar de una diferencia contra el total capturado.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CfdiConceptosPreview } from "../CfdiConceptosPreview";
import type { CfdiConceptoParsed } from "@/features/cxp/services";

const conceptos = [
  { descripcion: "Flete", cantidad: 1, valor_unitario: 1000, importe: 1000, iva: 160, ieps: 40 },
] as unknown as CfdiConceptoParsed[];

describe("CfdiConceptosPreview · conciliación con la cabecera", () => {
  it("muestra las retenciones del documento y cuadra sin avisos", () => {
    render(
      <CfdiConceptosPreview
        conceptos={conceptos}
        moneda="MXN"
        retencionesDocumento={100}
        totalDocumento={1100}
      />,
    );
    expect(screen.getByText("Retenciones MXN")).toBeInTheDocument();
    expect(screen.queryByText(/difiere en/i)).toBeNull();
  });

  it("avisa cuando la suma por partida no coincide con el total capturado", () => {
    render(
      <CfdiConceptosPreview
        conceptos={conceptos}
        moneda="MXN"
        retencionesDocumento={100}
        totalDocumento={1200}
      />,
    );
    expect(screen.getByText(/difiere en/i)).toBeInTheDocument();
  });

  it("deja explícito que los costos se concilian contra el subtotal sin impuestos", () => {
    render(<CfdiConceptosPreview conceptos={conceptos} moneda="MXN" />);
    expect(
      screen.getByText(/se concilian contra el subtotal \(sin impuestos\)/i),
    ).toBeInTheDocument();
  });
});
