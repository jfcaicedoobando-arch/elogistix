import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PortalProformaResumen } from "../PortalProformaResumen";
import type { PortalProformaConcepto, PortalProformaData } from "../../../services/portalPublico";

const proforma = {
  numero: "PF-1", expediente: "EXP-1", cliente_nombre: "Cliente", moneda: "MXN",
  subtotal: 600, iva: 24, total: 624, subtotal_mxn: 600, iva_mxn: 24,
  total_mxn: 624, subtotal_usd: 0, iva_usd: 0, total_usd: 0,
} as PortalProformaData;

const tipos = ["gravado_16", "gravado_8", "tasa_0", "exento", "no_objeto", null] as const;
const conceptos = tipos.map((tipo_iva, index) => ({
  id: String(index), descripcion: `Servicio ${index}`, cantidad: 1,
  precio_unitario: 100, importe: 100, moneda: "MXN", tipo_iva,
  aplica_iva: tipo_iva == null ? false : !["exento", "no_objeto"].includes(tipo_iva),
})) as PortalProformaConcepto[];

describe("PortalProformaResumen IVA por renglón", () => {
  it("muestra los cinco tratamientos y Por confirmar para legacy", () => {
    render(<PortalProformaResumen proforma={proforma} conceptos={conceptos} />);
    for (const etiqueta of ["16%", "8%", "0%", "Exento", "No objeto", "Por confirmar"]) {
      expect(screen.getByText(etiqueta)).toBeInTheDocument();
    }
  });
});