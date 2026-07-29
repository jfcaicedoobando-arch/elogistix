/**
 * Cuentas, tipo de cambio, cliente y proveedor de la semilla demo E2E.
 * Extraído de `seedDemoData.ts` (Power-of-10).
 */

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
