/**
 * Catálogos SAT mínimos para timbrado CFDI 4.0 con Facturapi.
 * Subset enfocado en operación logística/forwarder en MX.
 */

export const USOS_CFDI_SAT: Array<{ value: string; label: string }> = [
  { value: "G01", label: "G01 - Adquisición de mercancías" },
  { value: "G03", label: "G03 - Gastos en general" },
  { value: "I04", label: "I04 - Equipo de cómputo y accesorios" },
  { value: "P01", label: "P01 - Por definir" },
  { value: "S01", label: "S01 - Sin efectos fiscales" },
];

export const FORMAS_PAGO_SAT: Array<{ value: string; label: string }> = [
  { value: "01", label: "01 - Efectivo" },
  { value: "02", label: "02 - Cheque nominativo" },
  { value: "03", label: "03 - Transferencia electrónica" },
  { value: "04", label: "04 - Tarjeta de crédito" },
  { value: "28", label: "28 - Tarjeta de débito" },
  { value: "99", label: "99 - Por definir" },
];

export const METODOS_PAGO_SAT: Array<{ value: string; label: string }> = [
  { value: "PUE", label: "PUE - Pago en una sola exhibición" },
  { value: "PPD", label: "PPD - Pago en parcialidades o diferido" },
];

export const MOTIVOS_CANCELACION_SAT: Array<{ value: "01" | "02" | "03" | "04"; label: string }> = [
  { value: "01", label: "01 - Comprobante emitido con errores con relación" },
  { value: "02", label: "02 - Comprobante emitido con errores sin relación" },
  { value: "03", label: "03 - No se llevó a cabo la operación" },
  { value: "04", label: "04 - Operación nominativa relacionada en factura global" },
];
