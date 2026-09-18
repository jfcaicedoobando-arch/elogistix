/**
 * Validaciones puras para timbrado de facturas (CFDI 4.0).
 * Sin dependencias de React ni Supabase: testeable de forma aislada.
 *
 * v13.171.0 — se agrega check obligatorio de `tipo_cambio` para facturas
 * en moneda extranjera. MXN queda exento (TC implícito = 1).
 */

import { validarFormaMetodoPago } from "@/lib/financial/formaMetodoPago";

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

  // P1 · Auditoría fiscal — la pareja forma/método se valida con la MISMA regla
  // que aplica el servidor (PPD ⇒ 99; PUE ⇒ clave real), para no ofrecer un
  // timbrado que el backend va a rechazar.
  const issuesPago = validarFormaMetodoPago(p.formaPago, p.metodoPago);
  const issueForma = issuesPago.find((i) => i.field === "forma_pago");
  const issueMetodo = issuesPago.find((i) => i.field === "metodo_pago");

  const checks: CheckTimbrado[] = [
    { ok: !!p.rfc && p.rfc.length >= RFC_MIN_LENGTH, label: `RFC del cliente: ${p.rfc || "FALTA"}` },
    { ok: !!p.cp && CP_REGEX.test(p.cp), label: `Código postal: ${p.cp || "FALTA"}` },
    { ok: !!p.regimen, label: `Régimen fiscal: ${p.regimen || "FALTA"}` },
    { ok: !!p.usoCfdi, label: `Uso CFDI: ${p.usoCfdi}` },
    {
      ok: !issueForma,
      label: issueForma
        ? `Forma de pago SAT: ${p.formaPago || "FALTA"} — ${issueForma.message}`
        : `Forma de pago SAT: ${p.formaPago}`,
    },
    {
      ok: !issueMetodo,
      label: issueMetodo
        ? `Método de pago SAT: ${p.metodoPago || "FALTA"} — ${issueMetodo.message}`
        : `Método de pago SAT: ${p.metodoPago}`,
    },
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
