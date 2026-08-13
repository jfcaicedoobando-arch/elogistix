import { describe, it, expect } from "vitest";
import {
  puedeOperarRefacturacion,
  motivoBloqueoRefacturacion,
} from "@/features/facturacion/domain/refacturacionPermisos";
import { bloqueoPaso } from "@/features/facturacion/domain/refacturacionPasos";

describe("permisos de refacturación", () => {
  it("permite a administradores y a todos los roles contables", () => {
    for (const r of ["super_admin", "admin_org", "admin", "contador", "auxiliar_contable"] as const) {
      expect(puedeOperarRefacturacion(r)).toBe(true);
      expect(motivoBloqueoRefacturacion(r)).toBeNull();
    }
  });

  it("niega a roles no contables y sin sesión", () => {
    for (const r of ["tesorero", "vendedor", "operador", "viewer", null] as const) {
      expect(puedeOperarRefacturacion(r)).toBe(false);
      expect(motivoBloqueoRefacturacion(r)).toContain("rol contable");
    }
  });

  it("el bloqueo por permiso gana en los 5 pasos", () => {
    const ctx = {
      casoAbierto: true,
      clienteDestinoId: "c1",
      motivo: "pago desde otra empresa",
      pagos: [],
      facturaNueva: null,
      original: null,
      pagoSeleccionadoId: null,
      pagoYaReasignado: true,
      bloqueoPermiso: "sin permiso",
    };
    for (const paso of [1, 2, 3, 4, 5]) {
      expect(bloqueoPaso(paso, ctx)).toBe("sin permiso");
    }
  });
});
