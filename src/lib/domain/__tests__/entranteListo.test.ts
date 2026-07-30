/**
 * Semáforo "listo para capturar" del buzón CxP.
 */
import { describe, it, expect } from "vitest";
import {
  esProveedorNacional,
  evaluarListoEntrante,
  etiquetaListoEntrante,
} from "@/lib/domain/entranteListo";

describe("evaluarListoEntrante (buzón CxP)", () => {
  it("marca listo un CFDI nacional con XML, proveedor e importe", () => {
    const res = evaluarListoEntrante({
      estado: "por_capturar",
      xml_path: "org/doc.xml",
      uuid_fiscal: "AAA",
      rfc_emisor: "AAA010101AAA",
      proveedor_id: "p1",
      total_detectado: 1160,
      proveedores: { nombre: "Naviera", origen_proveedor: "Nacional" },
    });
    expect(res.nivel).toBe("listo");
    expect(res.puedeCapturar).toBe(true);
    expect(etiquetaListoEntrante(res)).toBe("Listo para capturar");
  });

  it("pide revisar un nacional sin XML pero permite capturar a mano", () => {
    const res = evaluarListoEntrante({
      estado: "por_capturar",
      xml_path: null,
      proveedor_id: "p1",
      total_detectado: null,
      proveedores: { nombre: "Transportista", origen_proveedor: "Nacional" },
    });
    expect(res.nivel).toBe("revisar");
    expect(res.puedeCapturar).toBe(true);
    expect(res.faltantes).toContain("Falta el XML del CFDI");
    expect(res.faltantes).toContain("Sin importe detectado");
  });

  it("no exige XML a un proveedor extranjero", () => {
    const res = evaluarListoEntrante({
      estado: "por_capturar",
      xml_path: null,
      proveedor_id: "p2",
      total_detectado: 500,
      proveedores: { nombre: "Agent HK", origen_proveedor: "Extranjero" },
    });
    expect(res.nivel).toBe("listo");
  });

  it("bloquea un documento ya procesado", () => {
    const res = evaluarListoEntrante({ estado: "capturada", xml_path: "x.xml" });
    expect(res.nivel).toBe("bloqueado");
    expect(res.puedeCapturar).toBe(false);
  });

  it("trata como nacional al documento sin proveedor identificado", () => {
    expect(esProveedorNacional({})).toBe(true);
    const res = evaluarListoEntrante({ estado: "por_capturar" });
    expect(res.faltantes).toContain("Proveedor sin identificar");
  });
});
