import { describe, expect, it } from "vitest";
import {
  descripcionHumana,
  esClaveTecnica,
  etiquetaCampo,
} from "@/features/embarques/domain/actividadDescripcion";

const UUID = "5837e08f-2aca-4646-9c27-1c4e7d6323ea";

describe("descripcionHumana (P2-A)", () => {
  it("traduce las descripciones reales del RPC de ELIMP00008", () => {
    expect(descripcionHumana("Factura: factura.borrador_generado")).toBe(
      "Se generó un borrador de factura",
    );
    expect(descripcionHumana("Proforma: proforma.aceptada_sin_autorizacion")).toBe(
      "Proforma aceptada sin autorización previa",
    );
    expect(descripcionHumana("Cotización: editar_cotizacion")).toBe("Edición de la cotización");
  });

  it("conserva sin cambios una descripción ya natural", () => {
    const natural = "El cliente autorizó la proforma PRO-2026-0009 por teléfono.";
    expect(descripcionHumana(natural)).toBe(natural);
    expect(descripcionHumana("Costo: flete marítimo Shanghái → Manzanillo")).toBe(
      "Costo: flete marítimo Shanghái → Manzanillo",
    );
  });

  it("una clave suelta sin prefijo también se humaniza", () => {
    expect(descripcionHumana("cambio_financiero_facturas")).toBe("Cambio financiero en facturas");
    expect(descripcionHumana("evento.nuevo_sin_catalogo")).toBe("Evento nuevo sin catalogo");
  });

  it("mantiene el prefijo cuando aporta contexto distinto", () => {
    expect(descripcionHumana("Embarque: recalcular_demoras")).toBe(
      "Embarque: Recálculo de demoras automáticas",
    );
  });

  it("no filtra UUID al texto principal", () => {
    expect(descripcionHumana(`Factura: factura.borrador_generado ${UUID}`)).not.toContain(UUID);
    expect(descripcionHumana(`Documento cargado ${UUID}`)).toBe("Documento cargado");
  });

  it("tolera vacío y nulos", () => {
    expect(descripcionHumana(null)).toBe("");
    expect(descripcionHumana(undefined)).toBe("");
    expect(descripcionHumana("   ")).toBe("");
  });

  it("reconoce claves técnicas y no confunde texto con espacios", () => {
    expect(esClaveTecnica("factura.borrador_generado")).toBe(true);
    expect(esClaveTecnica("editar_cotizacion")).toBe(true);
    expect(esClaveTecnica("Se emitió la factura")).toBe(false);
  });
});

describe("etiquetaCampo (P2-A)", () => {
  it("usa nombres de negocio para los campos habituales", () => {
    expect(etiquetaCampo("bl_master")).toBe("BL Master");
    expect(etiquetaCampo("contenedor")).toBe("Contenedor");
    expect(etiquetaCampo("etd")).toBe("ETD");
    expect(etiquetaCampo("eta")).toBe("ETA");
  });

  it("un campo desconocido queda legible, nunca snake_case", () => {
    expect(etiquetaCampo("campo_nuevo_backend")).toBe("Campo nuevo backend");
    expect(etiquetaCampo("")).toBe("Campo");
  });
});
