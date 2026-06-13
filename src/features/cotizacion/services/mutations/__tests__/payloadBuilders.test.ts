import { describe, it, expect } from "vitest";
import { buildCotizacionInsertPayload } from "../payloadBuilders";
import type { CreateCotizacionInput } from "@/features/cotizacion/types";

const baseInput: CreateCotizacionInput = {
  cliente_id: "cli-1",
  cliente_nombre: "ACME",
  es_prospecto: false,
  prospecto_empresa: "",
  prospecto_contacto: "",
  prospecto_email: "",
  prospecto_telefono: "",
  modo: "Marítimo",
  tipo: "Importación",
  incoterm: "FOB",
  descripcion_mercancia: "Pallets",
  peso_kg: 1000,
  volumen_m3: 20,
  piezas: 5,
  origen: "MXZLO",
  destino: "MXMEX",
  tipo_carga: "FCL",
  tipo_embarque: "FCL",
  tipo_contenedor: "20'",
  tipo_peso: "Peso Normal",
  msds_archivo: null,
  descripcion_adicional: "",
  sector_economico: "",
  dimensiones_lcl: [],
  dimensiones_aereas: [],
  num_contenedores: 1,
  conceptos_venta: [],
  subtotal: 1500,
  moneda: "USD",
  vigencia_dias: 15,
  notas: null,
  operador: "ana",
  dias_libres_destino: 7,
  dias_almacenaje: 3,
  tiempo_transito_dias: 30,
  frecuencia: "semanal",
  ruta_texto: "ZLO→MEX",
  validez_propuesta: null,
  tipo_movimiento: "Puerto a Puerto",
  seguro: false,
  valor_seguro_usd: 0,
  carta_garantia: false,
} as unknown as CreateCotizacionInput;

describe("buildCotizacionInsertPayload", () => {
  it("incluye folio, fecha_vigencia y los datos de cliente", () => {
    const r = buildCotizacionInsertPayload(baseInput, "COT-001", "2026-06-01");
    expect(r.folio).toBe("COT-001");
    expect(r.fecha_vigencia).toBe("2026-06-01");
    expect(r.cliente_id).toBe("cli-1");
    expect(r.cliente_nombre).toBe("ACME");
    expect(r.es_prospecto).toBe(false);
  });

  it("cuando es_prospecto=true, cliente_id va null", () => {
    const r = buildCotizacionInsertPayload(
      { ...baseInput, es_prospecto: true, prospecto_empresa: "Prospect SA" },
      "COT-002",
      "2026-06-01",
    );
    expect(r.cliente_id).toBeNull();
    expect(r.prospecto_empresa).toBe("Prospect SA");
  });

  it("mapea defaults de mercancía cuando los campos vienen vacíos", () => {
    const r = buildCotizacionInsertPayload(
      {
        ...baseInput,
        tipo_carga: "",
        tipo_embarque: "",
        tipo_peso: "",
        msds_archivo: null,
      } as CreateCotizacionInput,
      "COT-003",
      "2026-06-01",
    );
    expect(r.tipo_carga).toBe("Carga General");
    expect(r.tipo_embarque).toBe("FCL");
    expect(r.tipo_peso).toBe("Peso Normal");
    expect(r.msds_archivo).toBeNull();
  });

  it("expone subtotal, moneda y operador en la parte comercial", () => {
    const r = buildCotizacionInsertPayload(baseInput, "COT-004", "2026-06-01");
    expect(r.subtotal).toBe(1500);
    expect(r.moneda).toBe("USD");
    expect(r.operador).toBe("ana");
    expect(r.dias_libres_destino).toBe(7);
  });
});
