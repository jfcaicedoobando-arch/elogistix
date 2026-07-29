/**
 * Catálogos de la semilla demo E2E (navieras, agentes, rutas, tarifas,
 * productos/servicios). Extraído de `seedDemoData.ts` (Power-of-10).
 */
import { TASA_IVA } from "@/lib/financial/financialUtils";

/** Naviera demo. Clave natural: `code` (única y global en `navieras`). */
export interface SeedNaviera {
  code: string;
  name: string;
}

/** Puerto ya existente en el catálogo global `puertos` (no se crea, se referencia). */
export interface SeedPuertoRef {
  code: string;
}

/** Agente de carga (`costeo_agentes`). Clave natural: `(organization_id, nombre)`. */
export interface SeedAgente {
  nombre: string;
  pais: string;
  diasCredito: number;
  email: string;
}

/** Ruta (`costeo_rutas`). Clave natural: `(organization_id, puerto_origen, puerto_destino)`. */
export interface SeedRuta {
  puertoOrigen: SeedPuertoRef;
  puertoDestino: SeedPuertoRef;
}

/**
 * Tarifa vigente (`costeo_tarifas`). Clave natural:
 * `(organization_id, agente, naviera, ruta, tipo_contenedor, vigente_desde)`.
 */
export interface SeedTarifa {
  agenteNombre: string;
  navieraCode: string;
  ruta: SeedRuta;
  tipoContenedorCode: string;
  moneda: "USD" | "MXN";
  fleteBase: number;
  diasVigenciaDesdeHoy: number;
  diasDuracionVigencia: number;
}

/** Producto/servicio (`catalogo_claves_sat`). Clave natural: `(organization_id, lower(patron))`. */
export interface SeedProductoServicio {
  patron: string;
  claveSat: string;
  claveUnidadSat: string;
  nombreUnidad: string;
  tasaIvaDefault: number;
}

export const SEED_NAVIERAS: readonly SeedNaviera[] = [
  { code: "E2EMSC", name: "E2E Demo — MSC" },
  { code: "E2ECMA", name: "E2E Demo — CMA CGM" },
  { code: "E2EONE", name: "E2E Demo — ONE" },
];

export const SEED_AGENTES: readonly SeedAgente[] = [
  { nombre: "E2E Agente Carga Shanghai", pais: "CN", diasCredito: 30, email: "agente1@e2e-demo.test" },
  { nombre: "E2E Agente Carga Ningbo", pais: "CN", diasCredito: 45, email: "agente2@e2e-demo.test" },
];

export const SEED_RUTAS: readonly SeedRuta[] = [
  { puertoOrigen: { code: "CNSHA" }, puertoDestino: { code: "MXZLO" } },
  { puertoOrigen: { code: "CNNGB" }, puertoDestino: { code: "MXLZC" } },
];

export const SEED_TARIFAS: readonly SeedTarifa[] = [
  {
    agenteNombre: "E2E Agente Carga Shanghai",
    navieraCode: "E2EMSC",
    ruta: SEED_RUTAS[0],
    tipoContenedorCode: "40HC",
    moneda: "USD",
    fleteBase: 2450,
    diasVigenciaDesdeHoy: -30,
    diasDuracionVigencia: 180,
  },
  {
    agenteNombre: "E2E Agente Carga Shanghai",
    navieraCode: "E2ECMA",
    ruta: SEED_RUTAS[0],
    tipoContenedorCode: "20GP",
    moneda: "USD",
    fleteBase: 1800,
    diasVigenciaDesdeHoy: -15,
    diasDuracionVigencia: 180,
  },
  {
    agenteNombre: "E2E Agente Carga Ningbo",
    navieraCode: "E2EONE",
    ruta: SEED_RUTAS[1],
    tipoContenedorCode: "40HC",
    moneda: "USD",
    fleteBase: 2600,
    diasVigenciaDesdeHoy: -10,
    diasDuracionVigencia: 180,
  },
];

export const SEED_PRODUCTOS_SERVICIOS: readonly SeedProductoServicio[] = [
  { patron: "flete maritimo", claveSat: "78101800", claveUnidadSat: "E48", nombreUnidad: "Unidad de servicio", tasaIvaDefault: TASA_IVA },
  { patron: "flete terrestre", claveSat: "78101800", claveUnidadSat: "E48", nombreUnidad: "Unidad de servicio", tasaIvaDefault: TASA_IVA },
  { patron: "maniobras", claveSat: "78102200", claveUnidadSat: "E48", nombreUnidad: "Unidad de servicio", tasaIvaDefault: TASA_IVA },
  { patron: "almacenaje", claveSat: "78102200", claveUnidadSat: "E48", nombreUnidad: "Unidad de servicio", tasaIvaDefault: TASA_IVA },
  { patron: "agente aduanal", claveSat: "78102100", claveUnidadSat: "E48", nombreUnidad: "Unidad de servicio", tasaIvaDefault: TASA_IVA },
  { patron: "seguro de carga", claveSat: "84131503", claveUnidadSat: "E48", nombreUnidad: "Unidad de servicio", tasaIvaDefault: TASA_IVA },
  { patron: "demoras", claveSat: "78102200", claveUnidadSat: "E48", nombreUnidad: "Unidad de servicio", tasaIvaDefault: TASA_IVA },
  { patron: "custodia", claveSat: "78111808", claveUnidadSat: "E48", nombreUnidad: "Unidad de servicio", tasaIvaDefault: TASA_IVA },
];
