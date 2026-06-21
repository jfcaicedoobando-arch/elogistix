/**
 * Validaciones puras para timbrado de REP (Complemento de Pagos).
 * v13.91.0. Sin dependencias de React ni Supabase.
 */

export interface CheckRep { ok: boolean; label: string }

export interface ParametrosChecksRep {
  facturaUuid: string | null | undefined;
  facturaMetodoPago: string | null | undefined;
  rfc: string;
  cp: string;
  regimen: string;
  formaPago: string;
  monto: number;
  moneda: string;
  tipoCambio: number;
}

export interface ResultadoChecksRep {
  checks: CheckRep[];
  puedeTimbrar: boolean;
}

const RFC_MIN = 12;
const CP_RX = /^\d{5}$/;

export function buildChecksRep(p: ParametrosChecksRep): ResultadoChecksRep {
  const tcOk = p.moneda === "MXN" ? true : p.tipoCambio > 0;
  const checks: CheckRep[] = [
    { ok: !!p.facturaUuid, label: `Factura original timbrada (UUID): ${p.facturaUuid ? p.facturaUuid.slice(0, 8) + "…" : "FALTA"}` },
    { ok: p.facturaMetodoPago === "PPD", label: `Factura es PPD: ${p.facturaMetodoPago ?? "FALTA"}` },
    { ok: !!p.rfc && p.rfc.length >= RFC_MIN, label: `RFC del receptor: ${p.rfc || "FALTA"}` },
    { ok: !!p.cp && CP_RX.test(p.cp), label: `Código postal: ${p.cp || "FALTA"}` },
    { ok: !!p.regimen, label: `Régimen fiscal: ${p.regimen || "FALTA"}` },
    { ok: !!p.formaPago, label: `Forma de pago SAT: ${p.formaPago || "FALTA"}` },
    { ok: p.monto > 0, label: `Monto del pago: ${p.monto}` },
    { ok: tcOk, label: `Tipo de cambio: ${p.tipoCambio} (${p.moneda})` },
  ];
  return { checks, puedeTimbrar: checks.every((c) => c.ok) };
}
