/**
 * embarqueFromDb.extra — edge cases no cubiertos en embarqueFromDb.test.ts.
 */
import { describe, it, expect } from "vitest";
import { mapEmbarqueRowToFormValues, DEFAULT_EMBARQUE_VALUES } from "@/features/embarques/domain/mappers/embarqueFromDb";
import type { Tables } from "@/integrations/supabase/types";

type Row = Tables<"embarques">;

function row(over: Partial<Record<string, unknown>> = {}): Row {
  return {
    modo: "Marítimo", tipo: "Importación", cliente_id: "c99",
    shipper: "Shipper", consignatario: "Consig", incoterm: "CIF",
    descripcion_mercancia: "carga", peso_kg: 0, volumen_m3: 0, piezas: 0,
    tipo_carga: null, msds_archivo: null,
    puerto_origen: null, puerto_destino: null, naviera: null, agente: null,
    tipo_servicio: null, contenedor: null, tipo_contenedor: null,
    bl_master: null, bl_house: null,
    aeropuerto_origen: null, aeropuerto_destino: null, aerolinea: null,
    mawb: null, hawb: null,
    ciudad_origen: null, ciudad_destino: null, transportista: null, carta_porte: null,
    etd: null, eta: null, tipo_cambio_usd: null, tipo_cambio_eur: null,
    ...over,
  } as unknown as Row;
}

describe("embarqueFromDb.extra — sección aéreo", () => {
  it("[EFD-01] aeropuertos y códigos aéreos se mapean cuando están poblados", () => {
    const v = mapEmbarqueRowToFormValues(
      row({ aeropuerto_origen: "MEX", aeropuerto_destino: "MIA", aerolinea: "AM", mawb: "001-12345678", hawb: "H001" }),
    );
    expect(v.aeropuertoOrigen).toBe("MEX");
    expect(v.aeropuertoDestino).toBe("MIA");
    expect(v.aerolinea).toBe("AM");
    expect(v.mawb).toBe("001-12345678");
    expect(v.hawb).toBe("H001");
  });

  it("[EFD-02] campos aéreo son string vacío cuando son null en BD", () => {
    const v = mapEmbarqueRowToFormValues(row());
    expect(v.aeropuertoOrigen).toBe("");
    expect(v.aeropuertoDestino).toBe("");
    expect(v.aerolinea).toBe("");
  });
});

describe("embarqueFromDb.extra — sección terrestre", () => {
  it("[EFD-03] ciudades y transportista se mapean cuando están poblados", () => {
    const v = mapEmbarqueRowToFormValues(
      row({ ciudad_origen: "Monterrey", ciudad_destino: "CDMX", transportista: "TMS", carta_porte: "CP-001" }),
    );
    expect(v.ciudadOrigen).toBe("Monterrey");
    expect(v.ciudadDestino).toBe("CDMX");
    expect(v.transportista).toBe("TMS");
    expect(v.cartaPorte).toBe("CP-001");
  });

  it("[EFD-04] campos terrestre son string vacío cuando son null en BD", () => {
    const v = mapEmbarqueRowToFormValues(row());
    expect(v.ciudadOrigen).toBe("");
    expect(v.ciudadDestino).toBe("");
    expect(v.transportista).toBe("");
    expect(v.cartaPorte).toBe("");
  });
});

describe("embarqueFromDb.extra — datosGenerales", () => {
  it("[EFD-05] tipo_carga explícito sobrescribe el default 'Carga General'", () => {
    const v = mapEmbarqueRowToFormValues(row({ tipo_carga: "Mercancía Peligrosa" }));
    expect(v.tipoCarga).toBe("Mercancía Peligrosa");
  });

  it("[EFD-06] msds_archivo no-null se preserva", () => {
    const v = mapEmbarqueRowToFormValues(row({ msds_archivo: "https://bucket.io/file.pdf" }));
    expect(v.msdsArchivo).toBe("https://bucket.io/file.pdf");
  });

  it("[EFD-07] shipperManual y consignatarioManual siempre son string vacío", () => {
    const v = mapEmbarqueRowToFormValues(row({ shipper: "Alguien", consignatario: "Otro" }));
    expect(v.shipperManual).toBe("");
    expect(v.consignatarioManual).toBe("");
  });

  it("[EFD-08] subiendoMsds siempre es false independiente de la fila BD", () => {
    const v = mapEmbarqueRowToFormValues(row());
    expect(v.subiendoMsds).toBe(false);
  });
});

describe("embarqueFromDb.extra — fechas y tipos de cambio", () => {
  it("[EFD-09] etd/eta null se convierten a string vacío", () => {
    const v = mapEmbarqueRowToFormValues(row({ etd: null, eta: null }));
    expect(v.etd).toBe("");
    expect(v.eta).toBe("");
  });

  it("[EFD-10] DEFAULT_EMBARQUE_VALUES: contenedores=[], msdsArchivo=null, subiendoMsds=false", () => {
    expect(DEFAULT_EMBARQUE_VALUES.contenedores).toEqual([]);
    expect(DEFAULT_EMBARQUE_VALUES.msdsArchivo).toBeNull();
    expect(DEFAULT_EMBARQUE_VALUES.subiendoMsds).toBe(false);
  });
});
