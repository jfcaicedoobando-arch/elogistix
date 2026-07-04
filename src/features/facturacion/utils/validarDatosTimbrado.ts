/**
 * Validaciones puras para timbrado de facturas (CFDI 4.0).
 * Sin dependencias de React ni Supabase: testeable de forma aislada.
 *
 * v13.171.0 — se agrega check obligatorio de `tipo_cambio` para facturas
 * en moneda extranjera. MXN queda exento (TC implícito = 1).
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
  moneda?: string;
  tipoCambio?: number | null;
}

export interface ResultadoChecksTimbrado {
  checks: CheckTimbrado[];
  puedeTimbrar: boolean;
}

const RFC_MIN_LENGTH = 12; // RFC moral: 12, física: 13
const CP_REGEX = /^\d{5}$/;

export function buildChecksTimbrado(p: ParametrosChecksTimbrado): ResultadoChecksTimbrado {
  const moneda = p.moneda ?? "MXN";
  const tcOk =
    moneda === "MXN" ||
    (p.tipoCambio != null && Number.isFinite(p.tipoCambio) && p.tipoCambio > 0);

  const checks: CheckTimbrado[] = [
    { ok: !!p.rfc && p.rfc.length >= RFC_MIN_LENGTH, label: `RFC del cliente: ${p.rfc || "FALTA"}` },
    { ok: !!p.cp && CP_REGEX.test(p.cp), label: `Código postal: ${p.cp || "FALTA"}` },
    { ok: !!p.regimen, label: `Régimen fiscal: ${p.regimen || "FALTA"}` },
    { ok: !!p.usoCfdi, label: `Uso CFDI: ${p.usoCfdi}` },
    { ok: !!p.formaPago, label: `Forma de pago SAT: ${p.formaPago}` },
    { ok: !!p.metodoPago, label: `Método de pago SAT: ${p.metodoPago}` },
    {
      ok: tcOk,
      label:
        moneda === "MXN"
          ? "Tipo de cambio: N/A (MXN)"
          : `Tipo de cambio del día capturado: ${p.tipoCambio ?? "FALTA"}`,
    },
  ];
  return { checks, puedeTimbrar: checks.every((c) => c.ok) };
}
