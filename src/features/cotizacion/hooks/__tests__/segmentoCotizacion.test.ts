import { describe, it, expect } from "vitest";
import {
  matchesSegmento,
  matchesCotizacionFilter,
  type CotizacionListItem,
} from "@/features/cotizacion/hooks/useCotizacionesPageController";

const base = {
  id: "1",
  folio: "COT-2026-0001",
  cliente_id: "cli-1",
  cliente_nombre: "Cliente SA",
  estado: "Enviada",
  created_at: new Date().toISOString(),
} as unknown as CotizacionListItem;

const prospecto = {
  ...base,
  id: "2",
  folio: "COT-P-2026-0001",
  cliente_id: null,
  es_prospecto: true,
  prospecto_empresa: "Prospecto SA",
} as unknown as CotizacionListItem;

describe("matchesSegmento", () => {
  it("segmento clientes excluye prospectos", () => {
    expect(matchesSegmento(base, "clientes")).toBe(true);
    expect(matchesSegmento(prospecto, "clientes")).toBe(false);
  });

  it("segmento prospectos sólo muestra es_prospecto", () => {
    expect(matchesSegmento(prospecto, "prospectos")).toBe(true);
    expect(matchesSegmento(base, "prospectos")).toBe(false);
  });

  it("segmento todas no filtra", () => {
    expect(matchesSegmento(base, "todas")).toBe(true);
    expect(matchesSegmento(prospecto, "todas")).toBe(true);
  });
});

describe("matchesCotizacionFilter con segmento", () => {
  const params = {
    search: "",
    filterEstado: "todos",
    filterCliente: "todos",
    filterSinCostos: false,
    incluirInactivas: false,
    soloAceptadasSinEmbarque: false,
  };

  it("filtra por segmento dentro del filtro global", () => {
    expect(matchesCotizacionFilter(prospecto, { ...params, segmento: "clientes" })).toBe(false);
    expect(matchesCotizacionFilter(prospecto, { ...params, segmento: "prospectos" })).toBe(true);
    expect(matchesCotizacionFilter(base, { ...params, segmento: "prospectos" })).toBe(false);
  });
});
