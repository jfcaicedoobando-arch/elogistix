/**
 * Regresión: el copy del candado de PDF debe cambiar según el estado, porque
 * en `Aceptada`/`En operación` sincronizar conceptos falla por trigger.
 */
import { describe, expect, it } from "vitest";
import { mensajeCotizacionSinImportes } from "../cotizacionSinImportes";

describe("mensajeCotizacionSinImportes", () => {
  it.each(["Borrador", "Solicitada", "Enviada"])(
    "en %s guía a sincronizar conceptos",
    (estado) => {
      const aviso = mensajeCotizacionSinImportes(estado);
      expect(aviso.title).toBe("La cotización no tiene importes");
      expect(aviso.description).toContain("sincroniza los conceptos de venta");
      expect(aviso.description).not.toContain("Re-cotizar");
    },
  );

  it.each(["Aceptada", "En operación"])("en %s guía a Re-cotizar", (estado) => {
    const aviso = mensajeCotizacionSinImportes(estado);
    expect(aviso.description).toContain("Re-cotizar");
    expect(aviso.description).not.toContain("sincroniza los conceptos");
  });

  it.each(["Rechazada", "Vencida", "Archivada"])(
    "en %s guía a nueva versión o revisión administrativa",
    (estado) => {
      const aviso = mensajeCotizacionSinImportes(estado);
      expect(aviso.description).toContain("nueva versión");
      expect(aviso.description).toContain("revisión administrativa");
      expect(aviso.description).not.toContain("sincroniza los conceptos");
    },
  );

  it("con embarque vinculado no sugiere sincronizar aunque el estado sea editable", () => {
    const aviso = mensajeCotizacionSinImportes("Borrador", true);
    expect(aviso.description).toContain("Re-cotizar");
  });

  it("con estado desconocido o nulo usa la guía editable", () => {
    expect(mensajeCotizacionSinImportes(null).description).toContain("sincroniza los conceptos de venta");
  });
});
