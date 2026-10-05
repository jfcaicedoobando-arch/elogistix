import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LibroPagosDocument, type FilaLibroPagosExport } from "../LibroPagosDocument";

const original: FilaLibroPagosExport = {
  fecha: "03/10/2026", tipo: "Anticipo a proveedor", contraparte: "Proveedor", documento: "—",
  metodo: "Transferencia", referencia: "Reserva documental", cuenta: "Operativa", monto: "MXN 0.03",
  tipoCambio: "1.0000", fuenteTc: "Moneda nacional", montoMxn: "MXN 0.03", estado: "Pendiente",
};
describe("AUD100 · exportación del libro", () => {
  it("conserva ambas entradas y explica bruto, devolución y neto sin ocultar dinero", () => {
    const { container } = render(<LibroPagosDocument resumen={{ periodo: "03/10/2026", cobrado: "MXN 0.00",
      pagado: "MXN 0.03", devuelto: "MXN 0.03", neto: "MXN 0.00", conteo: "2" }} filas={[
        original, { ...original, tipo: "Devolución de anticipo", referencia: "Devolución de reserva documental" },
      ]} />);
    expect(container).toHaveTextContent("Anticipo a proveedor");
    expect(container).toHaveTextContent("Devolución de anticipo");
    expect(container).toHaveTextContent("Total pagado (MXN): MXN 0.03");
    expect(container).toHaveTextContent("Devoluciones (MXN): MXN 0.03");
    expect(container).toHaveTextContent("Neto (MXN): MXN 0.00");
    expect(container).toHaveTextContent("devoluciones al TC del anticipo original");
  });
});
