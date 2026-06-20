/**
 * Validaciones puras para timbrado de facturas (CFDI 4.0).
 * Sin dependencias de React ni Supabase: testeable de forma aislada.
 */

export interface CheckTimbrado {
  ok: boolean;
  label: string;
}

export interface ParametrosChecksTimbrado {
  rfc: string;
  cp: string;
  regimen: string;
  usoCfdi: string;
  formaPago: string;
  metodoPago: string;
}

export interface ResultadoChecksTimbrado {
  checks: CheckTimbrado[];
  puedeTimbrar: boolean;
}

const RFC_MIN_LENGTH = 12; // RFC moral: 12, física: 13
const CP_REGEX = /^\d{5}$/;

export function buildChecksTimbrado(p: ParametrosChecksTimbrado): ResultadoChecksTimbrado {
  const checks: CheckTimbrado[] = [
    { ok: !!p.rfc && p.rfc.length >= RFC_MIN_LENGTH, label: `RFC del cliente: ${p.rfc || "FALTA"}` },
    { ok: !!p.cp && CP_REGEX.test(p.cp), label: `Código postal: ${p.cp || "FALTA"}` },
    { ok: !!p.regimen, label: `Régimen fiscal: ${p.regimen || "FALTA"}` },
    { ok: !!p.usoCfdi, label: `Uso CFDI: ${p.usoCfdi}` },
    { ok: !!p.formaPago, label: `Forma de pago SAT: ${p.formaPago}` },
    { ok: !!p.metodoPago, label: `Método de pago SAT: ${p.metodoPago}` },
  ];
  return { checks, puedeTimbrar: checks.every((c) => c.ok) };
}
