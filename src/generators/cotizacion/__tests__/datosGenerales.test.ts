import { describe, it, expect, vi } from "vitest";
import { buildDatosGenerales, buildMercancia } from "../datosGenerales";
import type { CotizacionRow } from "@/types/cotizacion";

vi.mock("@/lib/formatters", () => ({
  formatCurrency: (n: number, m: string) => `${m} ${n}`,
  formatDate: (d: string) => d,
}));

const base: Partial<CotizacionRow> = {
  modo: "Terrestre",
  tipo: "Importación",
  incoterm: "FOB",
  origen: "México",
  destino: "USA",
  vigencia_dias: 30,
  fecha_vigencia: null,
  operador: "Operador1",
  seguro: false,
  valor_seguro_usd: null,
  tipo_embarque: "FCL",
  tipo_contenedor: null,
  tipo_peso: "Neto",
  tipo_carga: null,
  sector_economico: "Automotriz",
  descripcion_mercancia: "",
  peso_kg: 100,
  volumen_m3: 2,
  piezas: 5,
  frecuencia: null,
  ruta_texto: null,
  tipo_movimiento: null,
  tiempo_transito_dias: null,
  dias_libres_destino: 0,
  carta_garantia: false,
  dias_almacenaje: 0,
};

describe("buildDatosGenerales", () => {
  it("incluye campos base siempre", () => {
    const rows = buildDatosGenerales(base as CotizacionRow);
    const keys = rows.map(([k]) => k);
    expect(keys).toContain("Modo");
    expect(keys).toContain("Incoterm");
    expect(keys).toContain("Vigencia");
    expect(keys).toContain("Seguro");
  });

  it("agrega seguro con valor cuando seguro=true", () => {
    const rows = buildDatosGenerales({ ...base, seguro: true, valor_seguro_usd: 5000 } as CotizacionRow);
    const seguro = rows.find(([k]) => k === "Seguro");
    expect(seguro?.[1]).toContain("Sí");
  });

  it("incluye filas marítimas FCL para modo Marítimo", () => {
    const rows = buildDatosGenerales({
      ...base,
      modo: "Marítimo",
      tipo_embarque: "FCL",
      dias_libres_destino: 7,
      carta_garantia: true,
    } as CotizacionRow);
    const keys = rows.map(([k]) => k);
    expect(keys).toContain("Días libres en destino");
    expect(keys).toContain("Carta garantía");
  });
});

describe("buildMercancia", () => {
  it("incluye peso/volumen/piezas para modo no marítimo no aéreo", () => {
    const rows = buildMercancia(base as CotizacionRow);
    const keys = rows.map(([k]) => k);
    expect(keys).toContain("Peso");
    expect(keys).toContain("Volumen");
    expect(keys).toContain("Piezas");
  });

  it("omite peso/volumen/piezas para modo Aéreo", () => {
    const rows = buildMercancia({ ...base, modo: "Aéreo" } as CotizacionRow);
    const keys = rows.map(([k]) => k);
    expect(keys).not.toContain("Volumen");
    expect(keys).not.toContain("Piezas");
  });

  it("agrega tipo de embarque y contenedor para Marítimo FCL", () => {
    const rows = buildMercancia({
      ...base,
      modo: "Marítimo",
      tipo_embarque: "FCL",
      tipo_contenedor: "40HC",
    } as CotizacionRow);
    const keys = rows.map(([k]) => k);
    expect(keys).toContain("Tipo de Embarque");
    expect(keys).toContain("Tipo de Contenedor");
  });
});
