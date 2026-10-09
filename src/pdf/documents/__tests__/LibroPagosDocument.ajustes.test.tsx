import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LibroPagosDocument } from "../LibroPagosDocument";
import { filasLibroPagosExport, libroPagosACsv, resumenLibroPagos } from "@/features/tesoreria/services";
import { totalesLibroPagos, type PagoLibro } from "@/features/tesoreria/domain";

const ajuste: PagoLibro = {
  id: "ajuste", tipo: "pago", fecha: "2026-10-06", contraparte: "Proveedor fixture",
  contraparte_id: null, documento_id: null, documento_folio: "FP-FIXTURE", moneda: "MXN", monto: 1,
  tipo_cambio: null, monto_mxn: 1, metodo_pago: "03", referencia: null,
  cuenta_bancaria_id: null, cuenta_alias: null, cuenta_banco: null, notas: null, embarque_id: null,
  diferencia_cambiaria_mxn: 0, estado_rep: null, folio_rep: null, es_ajuste: true,
  es_anticipo_aplicado: false, lote_id: null, conciliado: false, movimiento_id: null, created_at: null,
};

describe("AUD99/121 · contrato compartido CSV/PDF", () => {
  it("presenta ajuste tipado y pago ordinario sin heurísticas ni modificar sus importes", () => {
    const pagos = [Object.freeze(ajuste), Object.freeze({ ...ajuste, id: "real", es_ajuste: false,
      referencia: "Cierre sin pago: condonacion", metodo_pago: "Ajuste", monto: 2, monto_mxn: 2 })];
    const before = JSON.stringify(pagos);
    const filas = filasLibroPagosExport(pagos);
    const csv = libroPagosACsv(filas);
    const { container } = render(<LibroPagosDocument
      resumen={resumenLibroPagos("2026-10-06", "2026-10-06", totalesLibroPagos(pagos))} filas={filas} />);
    for (const label of ["Ajuste no monetario", "Pago a proveedor", "No aplica", "Pendiente", "MXN 1.00", "MXN 2.00"]) {
      expect(csv).toContain(label);
      expect(container).toHaveTextContent(label);
    }
    expect(container).toHaveTextContent(/Total pagado \(MXN\):\s*MXN 2\.00/);
    expect(JSON.stringify(pagos)).toBe(before);
  });
});
