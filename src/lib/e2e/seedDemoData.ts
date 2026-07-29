/**
 * src/lib/e2e/seedDemoData.ts
 *
 * Módulo puro (sin red, sin Supabase) con la "forma" de los datos semilla
 * de la organización demo E2E. `scripts/e2e/seed-demo.ts` importa estas
 * constantes y las inserta vía `psql` (upsert por clave natural).
 *
 * Se mantiene aquí (dentro de `src/`) — y no directamente en el script —
 * porque vitest sólo recolecta `src/**\/*.{test,spec}.ts`: así el test
 * unitario que valida su forma corre en la suite normal, sin tocar la DB.
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

/** Cuenta bancaria (`cuentas_bancarias`). Clave natural: `(organization_id, alias)`. */
export interface SeedCuentaBancaria {
  alias: string;
  banco: string;
  numeroCuenta: string;
  clabe: string;
  moneda: "MXN" | "USD";
  saldoInicial: number;
}

/** Tipo de cambio del día (`tipos_cambio_dof`). Clave natural: `fecha`. */
export interface SeedTipoCambio {
  usdMxn: number;
  fuente: string;
  origen: "manual";
}

/** Cliente demo (`clientes`). Clave natural: `(organization_id, upper(rfc))`. */
export interface SeedCliente {
  nombre: string;
  rfc: string;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  diasCredito: number;
}

/** Proveedor demo (`proveedores`). Clave natural: `(organization_id, upper(rfc))`. */
export interface SeedProveedor {
  nombre: string;
  rfc: string;
  contacto: string;
  email: string;
  telefono: string;
  categoria: "Logistico" | "GastoOperativo";
  tipo: string;
  monedaPreferida: "MXN" | "USD";
  diasCredito: number;
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

export const SEED_CUENTAS_BANCARIAS: readonly SeedCuentaBancaria[] = [
  { alias: "E2E Demo MXN", banco: "BBVA", numeroCuenta: "0123456789", clabe: "012180001234567895", moneda: "MXN", saldoInicial: 500000 },
  { alias: "E2E Demo USD", banco: "BBVA", numeroCuenta: "9876543210", clabe: "012180009876543212", moneda: "USD", saldoInicial: 25000 },
];

export const SEED_TIPO_CAMBIO: SeedTipoCambio = {
  usdMxn: 18.5,
  fuente: "e2e_seed",
  origen: "manual",
};

export const SEED_CLIENTE: SeedCliente = {
  nombre: "E2E Demo Cliente SA de CV",
  rfc: "EDC010101AB1",
  contacto: "Ana Cliente Demo",
  email: "cliente@e2e-demo.test",
  telefono: "5555550101",
  direccion: "Av. Demo 100",
  ciudad: "Ciudad de México",
  estado: "CDMX",
  cp: "01000",
  diasCredito: 30,
};

export const SEED_PROVEEDOR: SeedProveedor = {
  nombre: "E2E Demo Proveedor SA de CV",
  rfc: "EDP010101CD2",
  contacto: "Luis Proveedor Demo",
  email: "proveedor@e2e-demo.test",
  telefono: "5555550202",
  categoria: "Logistico",
  tipo: "Transportista",
  monedaPreferida: "MXN",
  diasCredito: 15,
};

/** Agrupa toda la semilla — útil para validaciones de forma en un solo lugar. */
export const SEED_DEMO_DATA = {
  navieras: SEED_NAVIERAS,
  agentes: SEED_AGENTES,
  rutas: SEED_RUTAS,
  tarifas: SEED_TARIFAS,
  productosServicios: SEED_PRODUCTOS_SERVICIOS,
  cuentasBancarias: SEED_CUENTAS_BANCARIAS,
  tipoCambio: SEED_TIPO_CAMBIO,
  cliente: SEED_CLIENTE,
  proveedor: SEED_PROVEEDOR,
} as const;
