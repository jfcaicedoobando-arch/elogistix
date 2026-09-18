/**
 * P1 · Auditoría fiscal — coherencia entre MétodoPago (PUE/PPD) y FormaPago
 * del CFDI 4.0.
 *
 * Reglas SAT (Anexo 20 / guía de llenado):
 *  - PPD = la operación NO está pagada al emitir ⇒ FormaPago debe ser "99"
 *    (Por definir). La forma real se declara después en el complemento de pago.
 *  - PUE = la operación YA está pagada ⇒ FormaPago debe ser una clave real del
 *    catálogo c_FormaPago, distinta de "99".
 *
 * Espejo servidor: `supabase/functions/_shared/formaMetodoPago.ts` (las edge
 * functions no pueden importar `src/`).
 *
 * Referencia: https://wwwmat.sat.gob.mx/consultas/35025/formato-de-factura-electronica-%28anexo-20%29
 */

export const FORMA_PAGO_POR_DEFINIR = "99";

export type MetodoPagoSat = "PUE" | "PPD";

/** c_FormaPago vigente (mismo conjunto que `FORMAS_PAGO_SAT` de la UI). */
export const CLAVES_FORMA_PAGO_SAT: readonly string[] = [
  "01", "02", "03", "04", "05", "06", "08", "12", "13", "14", "15",
  "17", "23", "24", "25", "26", "27", "28", "29", "30", "31", "99",
];

export const MSG_METODO_PAGO_REQUERIDO =
  "Método de pago SAT requerido (PUE o PPD).";
export const MSG_FORMA_PAGO_REQUERIDA =
  "Forma de pago SAT requerida (clave del catálogo c_FormaPago).";
export const MSG_FORMA_PAGO_DESCONOCIDA =
  "La forma de pago no pertenece al catálogo SAT c_FormaPago.";
export const MSG_PPD_REQUIERE_99 =
  "Con método PPD la operación aún no está pagada: la forma de pago debe ser 99 (Por definir). " +
  "La forma real del cobro se declara después en el complemento de pago.";
export const MSG_PUE_REQUIERE_FORMA_REAL =
  "Con método PUE la operación ya está pagada: elige la forma de pago real " +
  "(efectivo, transferencia, cheque, tarjeta…). La clave 99 sólo aplica a PPD.";

export interface IssueFormaMetodo {
  field: "forma_pago" | "metodo_pago";
  message: string;
}

/** Clave normalizada del catálogo, o `null` si está ausente o fuera de catálogo. */
export function normalizarClaveFormaPago(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const v = String(valor).trim();
  if (!/^\d{2}$/.test(v)) return null;
  return CLAVES_FORMA_PAGO_SAT.includes(v) ? v : null;
}

export function esMetodoPagoSat(valor: string | null | undefined): valor is MetodoPagoSat {
  return valor === "PUE" || valor === "PPD";
}

/**
 * Validación autoritativa de la pareja forma/método. Devuelve la lista de
 * problemas (vacía = combinación válida).
 */
export function validarFormaMetodoPago(
  formaPago: string | null | undefined,
  metodoPago: string | null | undefined,
): IssueFormaMetodo[] {
  const issues: IssueFormaMetodo[] = [];
  const metodo = metodoPago ? String(metodoPago).trim() : "";
  const forma = normalizarClaveFormaPago(formaPago);

  if (!metodo) issues.push({ field: "metodo_pago", message: MSG_METODO_PAGO_REQUERIDO });
  else if (!esMetodoPagoSat(metodo)) issues.push({ field: "metodo_pago", message: MSG_METODO_PAGO_REQUERIDO });

  if (!formaPago || String(formaPago).trim() === "") {
    issues.push({ field: "forma_pago", message: MSG_FORMA_PAGO_REQUERIDA });
  } else if (forma === null) {
    issues.push({ field: "forma_pago", message: MSG_FORMA_PAGO_DESCONOCIDA });
  }

  if (!esMetodoPagoSat(metodo) || forma === null) return issues;
  if (metodo === "PPD" && forma !== FORMA_PAGO_POR_DEFINIR) {
    issues.push({ field: "forma_pago", message: MSG_PPD_REQUIERE_99 });
  }
  if (metodo === "PUE" && forma === FORMA_PAGO_POR_DEFINIR) {
    issues.push({ field: "forma_pago", message: MSG_PUE_REQUIERE_FORMA_REAL });
  }
  return issues;
}

/**
 * Forma de pago que debe quedar seleccionada al cambiar PUE↔PPD, para no
 * arrastrar un dato obsoleto. PPD ⇒ 99; PUE ⇒ conserva la clave real elegida o
 * queda vacía (obliga a elegir).
 */
export function formaPagoParaMetodo(
  metodoPago: string | null | undefined,
  formaActual: string | null | undefined,
): string {
  const forma = normalizarClaveFormaPago(formaActual);
  if (metodoPago === "PPD") return FORMA_PAGO_POR_DEFINIR;
  if (metodoPago === "PUE") return forma && forma !== FORMA_PAGO_POR_DEFINIR ? forma : "";
  return forma ?? "";
}
