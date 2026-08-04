import { describe, it, expect } from "vitest";
import { mapEmbarqueRowToFormValues, DEFAULT_EMBARQUE_VALUES } from "../embarqueFromDb";
import type { Tables } from "@/integrations/supabase/types";

type Row = Tables<"embarques">;

const baseRow = {
  modo: "Marítimo",
  tipo: "Importación",
  cliente_id: "c1",
  shipper: "Shipper S.A.",
  consignatario: "Consig",
  incoterm: "CIF",
  descripcion_mercancia: "carga",
  peso_kg: 1000,
  volumen_m3: 25.5,
  piezas: 10,
  tipo_carga: null,
  msds_archivo: null,
  puerto_origen: "CNSHA",
  puerto_destino: "MXZLO",
  naviera: "COSCO",
  agente: null,
  tipo_servicio: "FCL",
  contenedor: "ABCD1234567",
  tipo_contenedor: "40HC",
  bl_master: "BL-M",
  bl_house: null,
  aeropuerto_origen: null,
  aeropuerto_destino: null,
  aerolinea: null,
  mawb: null,
  hawb: null,
  ciudad_origen: null,
  ciudad_destino: null,
  transportista: null,
  carta_porte: null,
  etd: "2026-01-10",
  eta: "2026-02-15",
  tipo_cambio_usd: 17.5,
  tipo_cambio_eur: 19.1,
} as unknown as Row;

describe("mapEmbarqueRowToFormValues", () => {
  it("mapea campos base y aplica default 'Carga General'", () => {
    const v = mapEmbarqueRowToFormValues(baseRow);
    expect(v.modo).toBe("Marítimo");
    expect(v.clienteId).toBe("c1");
    expect(v.tipoCarga).toBe("Carga General");
    expect(v.incoterm).toBe("CIF");
  });

  it("convierte numéricos a string para inputs RHF", () => {
    const v = mapEmbarqueRowToFormValues(baseRow);
    expect(v.pesoKg).toBe("1000");
    expect(v.volumenM3).toBe("25.5");
    expect(v.tipoCambioUSD).toBe("17.5");
    expect(v.tipoCambioEUR).toBe("19.1");
  });

  it("convierte null a string vacío en campos opcionales", () => {
    const v = mapEmbarqueRowToFormValues(baseRow);
    expect(v.agente).toBe("");
    expect(v.aeropuertoOrigen).toBe("");
    expect(v.blHouse).toBe("");
  });

  it("inicializa contenedores vacío y subiendoMsds false", () => {
    const v = mapEmbarqueRowToFormValues(baseRow);
    expect(v.contenedores).toEqual([]);
    expect(v.subiendoMsds).toBe(false);
  });

  it("DEFAULT_EMBARQUE_VALUES tiene incoterm FOB y TCs vacíos (se precargan del DOF)", () => {
    expect(DEFAULT_EMBARQUE_VALUES.incoterm).toBe("FOB");
    expect(DEFAULT_EMBARQUE_VALUES.tipoCarga).toBe("Carga General");
    expect(DEFAULT_EMBARQUE_VALUES.tipoCambioUSD).toBe("");
    expect(DEFAULT_EMBARQUE_VALUES.tipoCambioEUR).toBe("");
  });
});
