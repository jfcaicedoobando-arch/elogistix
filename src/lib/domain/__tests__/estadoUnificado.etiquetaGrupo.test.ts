/**
 * R170-01 · El grupo que agrupa proformas ya convertidas NO puede llamarse
 * "Facturada" en filtro, chip y contador: incluye proformas cuya única factura
 * sigue en Borrador (sin timbrar), es decir sin emisión fiscal.
 */
import { describe, it, expect } from "vitest";
import {
  getEstadoUnificado,
  LABEL_ESTADO_UNIFICADO,
} from "@/lib/domain/estadoUnificado";

describe("R170-01 · etiqueta del grupo de proformas convertidas", () => {
  it("una proforma con sólo factura Borrador cae en el grupo convertido", () => {
    expect(getEstadoUnificado({ estado_cliente: "aceptada", factura_id: "f1" })).toBe("facturada");
  });

  it("la etiqueta del grupo no promete emisión fiscal", () => {
    expect(LABEL_ESTADO_UNIFICADO.facturada).toBe("Convertida");
    expect(LABEL_ESTADO_UNIFICADO.facturada).not.toMatch(/Facturad/);
  });

  it("las demás etiquetas del filtro se conservan", () => {
    expect(LABEL_ESTADO_UNIFICADO.pendiente).toBe("Pendiente cliente");
    expect(LABEL_ESTADO_UNIFICADO.aceptada).toBe("Aceptada");
    expect(LABEL_ESTADO_UNIFICADO.rechazada).toBe("Rechazada");
  });
});
