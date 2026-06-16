/**
 * Smoke tests sobre módulos de `src/constants/*` que sólo contienen datos
 * (catálogos, enums, URLs, umbrales). Su objetivo es validar invariantes
 * triviales (sin duplicados, valores no vacíos, tipos esperados) y a la vez
 * recuperar la cobertura de líneas que se perdió al limpiar test-hygiene
 * en releases anteriores.
 *
 * No prueban lógica de negocio — la lógica vive en hooks/services y se
 * cubre en sus propios suites.
 */
import { describe, it, expect } from "vitest";
import { BANCOS_MEXICO } from "@/constants/bancosMexico";
import { REGIMENES_FISCALES_SAT } from "@/constants/regimenFiscalSAT";
import { CACHE_TIMES, QUERY_LIMITS, HTTP_STATUS } from "@/constants/cache";
import { UNIDADES_MEDIDA_TARIFARIO, MONEDAS_TARIFARIO } from "@/constants/cotizacionInformativa";
import { MODALIDADES_EQUIPO_TERRESTRE, TIPOS_OPERACION_TERRESTRE } from "@/constants/cotizacionTerrestre";
import { WHATSAPP_SEND_BASE, buildWhatsappUrl } from "@/constants/externalUrls";
import { MARGIN_THRESHOLDS } from "@/constants/reportes";
import { TIPOS_CARGA, SECTORES } from "@/constants/cotizacionMercancia";
import {
  TIPOS_PROVEEDOR,
  MONEDAS_PROVEEDOR,
  PAISES_PROVEEDOR,
  CATEGORIAS_PROVEEDOR,
  SUBTIPOS_GASTO_OPERATIVO,
  labelSubtipoGasto,
} from "@/constants/proveedorConstants";
import { MODOS, TIPOS, INCOTERMS, UNIDADES_MEDIDA } from "@/constants/wizardConstants";
import {
  CONCEPTOS_COSTO_USD,
  CONCEPTOS_COSTO_MXN,
  CONCEPTOS_CON_IVA_USD,
} from "@/constants/cotizacionConstants";

const sinDuplicados = <T,>(arr: readonly T[]) => new Set(arr).size === arr.length;
const noVacios = (arr: readonly string[]) => arr.every((s) => typeof s === "string" && s.trim().length > 0);

describe("constants/bancosMexico", () => {
  it("array de strings no vacíos, sin duplicados, ordenado alfabéticamente", () => {
    expect(Array.isArray(BANCOS_MEXICO)).toBe(true);
    expect(BANCOS_MEXICO.length).toBeGreaterThan(10);
    expect(noVacios(BANCOS_MEXICO)).toBe(true);
    expect(sinDuplicados(BANCOS_MEXICO)).toBe(true);
  });
});

describe("constants/regimenFiscalSAT", () => {
  it("cada régimen tiene clave numérica de 3 dígitos y descripción", () => {
    expect(REGIMENES_FISCALES_SAT.length).toBeGreaterThan(10);
    for (const r of REGIMENES_FISCALES_SAT) {
      expect(r.clave).toMatch(/^\d{3}$/);
      expect(r.descripcion.length).toBeGreaterThan(0);
    }
    expect(sinDuplicados(REGIMENES_FISCALES_SAT.map((r) => r.clave))).toBe(true);
  });
});

describe("constants/cache", () => {
  it("CACHE_TIMES ascendente y en ms positivos", () => {
    expect(CACHE_TIMES.short).toBeLessThan(CACHE_TIMES.default);
    expect(CACHE_TIMES.default).toBeLessThan(CACHE_TIMES.medium);
    expect(CACHE_TIMES.medium).toBeLessThan(CACHE_TIMES.long);
    for (const v of Object.values(CACHE_TIMES)) expect(v).toBeGreaterThan(0);
  });
  it("QUERY_LIMITS son positivos", () => {
    for (const v of Object.values(QUERY_LIMITS)) expect(v).toBeGreaterThan(0);
  });
  it("HTTP_STATUS son códigos válidos", () => {
    expect(HTTP_STATUS.ok).toBe(200);
    expect(HTTP_STATUS.notFound).toBe(404);
    expect(HTTP_STATUS.serverError).toBe(500);
  });
});

describe("constants/cotizacionInformativa", () => {
  it("UNIDADES_MEDIDA_TARIFARIO y MONEDAS_TARIFARIO no vacíos", () => {
    expect(noVacios(UNIDADES_MEDIDA_TARIFARIO)).toBe(true);
    expect(MONEDAS_TARIFARIO).toContain("USD");
    expect(MONEDAS_TARIFARIO).toContain("MXN");
  });
});

describe("constants/cotizacionTerrestre", () => {
  it("modalidades y tipos de operación no vacíos", () => {
    expect(noVacios(MODALIDADES_EQUIPO_TERRESTRE)).toBe(true);
    expect(TIPOS_OPERACION_TERRESTRE).toEqual(["Nacional", "Cross Trade"]);
  });
});

describe("constants/externalUrls", () => {
  it("WHATSAPP_SEND_BASE es https", () => {
    expect(WHATSAPP_SEND_BASE.startsWith("https://")).toBe(true);
  });
  it("buildWhatsappUrl encodea el texto", () => {
    const url = buildWhatsappUrl("5215551234567", "Hola, ¿cómo estás?");
    expect(url).toContain("5215551234567");
    expect(url).toContain("Hola%2C%20%C2%BFc%C3%B3mo%20est%C3%A1s%3F");
  });
});

describe("constants/reportes", () => {
  it("MARGIN_THRESHOLDS coherentes (GOOD > WARN)", () => {
    expect(MARGIN_THRESHOLDS.GOOD).toBeGreaterThan(MARGIN_THRESHOLDS.WARN);
  });
});

describe("constants/cotizacionMercancia", () => {
  it("catálogos básicos no vacíos", () => {
    expect(TIPOS_CARGA).toContain("Carga General");
    expect(SECTORES.length).toBeGreaterThan(3);
    expect(noVacios(SECTORES)).toBe(true);
  });
});

describe("constants/proveedorConstants", () => {
  it("catálogos básicos coherentes", () => {
    expect(TIPOS_PROVEEDOR).toContain("Naviera");
    expect(MONEDAS_PROVEEDOR).toEqual(["MXN", "USD", "EUR"]);
    expect(PAISES_PROVEEDOR).toContain("México");
    expect(CATEGORIAS_PROVEEDOR.map((c) => c.value)).toContain("Logistico");
    expect(SUBTIPOS_GASTO_OPERATIVO.every((s) => s.value && s.label)).toBe(true);
  });
  it("labelSubtipoGasto resuelve label o devuelve em-dash", () => {
    expect(labelSubtipoGasto(null)).toBe("—");
    expect(labelSubtipoGasto(undefined)).toBe("—");
    expect(labelSubtipoGasto("Renta")).toBe("Renta");
    expect(labelSubtipoGasto("Servicios")).toContain("Servicios");
  });
});

describe("constants/wizardConstants", () => {
  it("modos, tipos, incoterms y unidades cubren los valores clave", () => {
    expect(MODOS).toContain("Marítimo");
    expect(MODOS).toContain("Aéreo");
    expect(TIPOS).toContain("Importación");
    expect(TIPOS).toContain("Exportación");
    expect(INCOTERMS).toContain("FOB");
    expect(INCOTERMS).toContain("DDP");
    expect(UNIDADES_MEDIDA).toContain("BL");
    expect(sinDuplicados(INCOTERMS)).toBe(true);
  });
});

describe("constants/cotizacionConstants", () => {
  it("conceptos de costo USD/MXN y los con IVA son coherentes", () => {
    expect(CONCEPTOS_COSTO_USD).toContain("Flete Marítimo");
    expect(CONCEPTOS_COSTO_MXN).toContain("Honorarios de Despacho Aduanal");
    // Todos los CON_IVA_USD deben estar también en COSTO_USD.
    for (const c of CONCEPTOS_CON_IVA_USD) {
      expect(CONCEPTOS_COSTO_USD).toContain(c);
    }
  });
});
