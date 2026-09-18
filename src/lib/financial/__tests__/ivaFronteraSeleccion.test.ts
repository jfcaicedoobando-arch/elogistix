/**
 * P2-IVA (seguimiento) — el tratamiento `gravado_8` no se puede elegir ni
 * guardar mientras el estímulo fronterizo esté deshabilitado, pero un registro
 * que YA estaba al 8% se conserva y se puede seguir guardando con ese valor.
 */
import { describe, it, expect } from "vitest";
import {
  TIPO_IVA_FRONTERA,
  puedeGuardarTipoIva,
  tipoIvaSeleccionable,
} from "@/lib/financial/ivaFrontera";
import { TIPOS_IVA_SAT } from "@/lib/financial/tipoIvaSat";

describe("tipoIvaSeleccionable", () => {
  it("con el estímulo apagado sólo bloquea gravado_8", () => {
    for (const tipo of TIPOS_IVA_SAT) {
      expect(tipoIvaSeleccionable(tipo, false)).toBe(tipo !== TIPO_IVA_FRONTERA);
    }
  });

  it("con el estímulo habilitado permite todos los tratamientos", () => {
    for (const tipo of TIPOS_IVA_SAT) {
      expect(tipoIvaSeleccionable(tipo, true)).toBe(true);
    }
  });
});

describe("puedeGuardarTipoIva", () => {
  it("bloquea un alta nueva al 8% con el estímulo apagado", () => {
    expect(puedeGuardarTipoIva("gravado_8", undefined, false)).toBe(false);
    expect(puedeGuardarTipoIva("gravado_8", null, false)).toBe(false);
  });

  it("bloquea cambiar un producto gravado al 16% hacia 8% con el estímulo apagado", () => {
    expect(puedeGuardarTipoIva("gravado_8", "gravado_16", false)).toBe(false);
  });

  it("conserva un registro que ya estaba al 8% aunque el estímulo esté apagado", () => {
    expect(puedeGuardarTipoIva("gravado_8", "gravado_8", false)).toBe(true);
  });

  it("permite el 8% cuando Contabilidad habilitó el estímulo", () => {
    expect(puedeGuardarTipoIva("gravado_8", undefined, true)).toBe(true);
  });

  it("nunca bloquea los demás tratamientos", () => {
    for (const tipo of TIPOS_IVA_SAT.filter((t) => t !== TIPO_IVA_FRONTERA)) {
      expect(puedeGuardarTipoIva(tipo, undefined, false)).toBe(true);
    }
  });
});
