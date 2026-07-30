/**
 * Reglas puras del Buzón de facturas de proveedor (v13.365.0).
 */
import { describe, it, expect } from "vitest";
import {
  DIAS_ATRASO_BUZON,
  antiguedadEntrante,
  coincideBusquedaEntrante,
  entranteSinXml,
  etiquetaAntiguedad,
  filtrarEntrantes,
  ordenarEntrantes,
  resumirBuzon,
  type FilaBuzon,
} from "@/lib/domain/facturasEntrantesBuzon";

const AHORA = new Date("2026-07-30T12:00:00.000Z");

function fila(over: Partial<FilaBuzon> = {}): FilaBuzon {
  return {
    nombre_archivo: "FA001.pdf",
    created_at: "2026-07-30T08:00:00.000Z",
    archivo_path: "org/emb/hash-FA001.pdf",
    xml_path: "org/emb/hash-FA001.xml",
    folio_serie: "A-1",
    embarques: { expediente: "ELEXP00250" },
    proveedores: { nombre: "Evergreen Shipping", origen_proveedor: "Nacional" },
    ...over,
  };
}

describe("etiquetaAntiguedad", () => {
  it("usa etiquetas humanas para hoy y ayer", () => {
    expect(etiquetaAntiguedad(0)).toEqual({ label: "Hoy", tono: "neutral" });
    expect(etiquetaAntiguedad(1)).toEqual({ label: "Ayer", tono: "info" });
  });

  it("escala el tono conforme se atrasa el documento", () => {
    expect(etiquetaAntiguedad(2).tono).toBe("info");
    expect(etiquetaAntiguedad(DIAS_ATRASO_BUZON).tono).toBe("warning");
    expect(etiquetaAntiguedad(6).tono).toBe("warning");
    expect(etiquetaAntiguedad(7).tono).toBe("destructive");
  });

  it("resuelve la antigüedad de una fila", () => {
    const res = antiguedadEntrante(fila({ created_at: "2026-07-25T08:00:00.000Z" }), AHORA);
    expect(res.dias).toBe(5);
    expect(res.tono).toBe("warning");
  });
});

describe("entranteSinXml", () => {
  it("marca al proveedor nacional que no entregó XML", () => {
    expect(entranteSinXml(fila({ xml_path: null }))).toBe(true);
  });

  it("no marca al proveedor extranjero (el PDF basta)", () => {
    const extranjero = fila({
      xml_path: null,
      proveedores: { nombre: "Maersk BV", origen_proveedor: "Extranjero" },
    });
    expect(entranteSinXml(extranjero)).toBe(false);
  });

  it("no marca cuando el XML sí está adjunto", () => {
    expect(entranteSinXml(fila())).toBe(false);
  });
});

describe("coincideBusquedaEntrante", () => {
  it("busca sin acentos ni mayúsculas en proveedor, expediente, folio y archivo", () => {
    const row = fila({ proveedores: { nombre: "Marítima Peña", origen_proveedor: "Nacional" } });
    expect(coincideBusquedaEntrante(row, "maritima")).toBe(true);
    expect(coincideBusquedaEntrante(row, "ELEXP002")).toBe(true);
    expect(coincideBusquedaEntrante(row, "a-1")).toBe(true);
    expect(coincideBusquedaEntrante(row, "fa001")).toBe(true);
    expect(coincideBusquedaEntrante(row, "hapag")).toBe(false);
  });

  it("acepta todo cuando el término está vacío", () => {
    expect(coincideBusquedaEntrante(fila(), "   ")).toBe(true);
  });
});

describe("filtrarEntrantes", () => {
  const viejo = fila({ created_at: "2026-07-20T08:00:00.000Z", nombre_archivo: "viejo.pdf" });
  const nuevo = fila({ created_at: "2026-07-30T08:00:00.000Z", nombre_archivo: "nuevo.pdf" });
  const sinXml = fila({ created_at: "2026-07-29T08:00:00.000Z", xml_path: null, nombre_archivo: "sinxml.pdf" });
  const conNota = fila({ created_at: "2026-07-28T08:00:00.000Z", nota: "Falta sello", nombre_archivo: "nota.pdf" });
  const todas = [nuevo, viejo, sinXml, conNota];

  it("ordena por antigüedad ascendente por defecto", () => {
    expect(filtrarEntrantes(todas, { ahora: AHORA }).map((r) => r.nombre_archivo)).toEqual([
      "viejo.pdf",
      "nota.pdf",
      "sinxml.pdf",
      "nuevo.pdf",
    ]);
  });

  it("aplica el chip de atrasados", () => {
    const res = filtrarEntrantes(todas, { chip: "atrasados", ahora: AHORA });
    expect(res.map((r) => r.nombre_archivo)).toEqual(["viejo.pdf"]);
  });

  it("aplica el chip de sin XML y el de nota", () => {
    expect(filtrarEntrantes(todas, { chip: "sin_xml", ahora: AHORA })).toHaveLength(1);
    expect(filtrarEntrantes(todas, { chip: "con_nota", ahora: AHORA })).toHaveLength(1);
  });

  it("combina búsqueda con chip", () => {
    const res = filtrarEntrantes(todas, { chip: "sin_xml", q: "nuevo", ahora: AHORA });
    expect(res).toHaveLength(0);
  });
});

describe("ordenarEntrantes", () => {
  it("ordena por proveedor alfabéticamente", () => {
    const a = fila({ proveedores: { nombre: "Zim", origen_proveedor: "Nacional" } });
    const b = fila({ proveedores: { nombre: "Alpha", origen_proveedor: "Nacional" } });
    expect(ordenarEntrantes([a, b], "proveedor")[0].proveedores?.nombre).toBe("Alpha");
  });

  it("ordena de más reciente a más antiguo", () => {
    const viejo = fila({ created_at: "2026-07-01T00:00:00.000Z", nombre_archivo: "v.pdf" });
    const nuevo = fila({ created_at: "2026-07-29T00:00:00.000Z", nombre_archivo: "n.pdf" });
    expect(ordenarEntrantes([viejo, nuevo], "recientes")[0].nombre_archivo).toBe("n.pdf");
  });
});

describe("resumirBuzon", () => {
  it("cuenta siempre sobre el total, no sobre lo filtrado", () => {
    const res = resumirBuzon(
      [
        fila({ created_at: "2026-07-20T00:00:00.000Z" }),
        fila({ xml_path: null }),
        fila(),
      ],
      AHORA,
    );
    expect(res).toEqual({ total: 3, atrasados: 1, sinXml: 1 });
  });
});
