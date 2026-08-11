/**
 * Traductor de errores específicos al registrar pagos a proveedor.
 *
 * Mapea PostgrestError (Supabase) y otros errores conocidos a mensajes en
 * español-MX listos para `notifyError`. Evita que mensajes en inglés
 * (RLS, FK, trigger violations) lleguen al usuario final.
 */

export interface ErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

const FALLBACK = "No se pudo registrar el pago. Inténtalo de nuevo.";

type Regla = (e: ErrorLike) => string | null;

const REGLAS: Regla[] = [
  (e) =>
    e.code === "LC_PAGO_SIN_APROBACION" || (e.message && e.message.includes("LC_PAGO_SIN_APROBACION"))
      ? "La factura debe estar aprobada antes de registrar pagos."
      : null,
  (e) =>
    e.code === "ORG_MISMATCH" || e.message === "ORG_MISMATCH"
      ? "La factura pertenece a otra organización. Cambia a la organización correcta y vuelve a intentarlo."
      : null,

  (e) =>
    e.code === "42501"
      ? "No tienes permiso para registrar pagos a proveedor en esta organización. Verifica tu rol o la organización activa."
      : null,
  (e) =>
    e.code === "23503"
      ? "Falta información relacionada (factura, cuenta bancaria o proveedor). Recarga la página e inténtalo de nuevo."
      : null,
  (e) => (e.code === "23505" ? "Ya existe un pago duplicado con esta referencia." : null),
  (e) =>
    e.message && (/SOBREPAGO_PROVEEDOR/i.test(e.message) || /excede el saldo pendiente/i.test(e.message))
      ? "El pago excede el saldo pendiente de la factura. Revisa los pagos previos y las notas de crédito aplicadas."
      : null,
  // v13.497.1: la regla de "embarque cerrado" debe evaluarse ANTES del 23514
  // genérico; el candado de cierre emite ERRCODE check_violation y el mensaje
  // genérico ("no cumplen una regla del sistema") resultaba ambiguo.
  (e) =>
    e.message && /embarque\s+cerrado/i.test(e.message)
      ? "El expediente del embarque está cerrado, por eso no se pudo actualizar su costo. Reabre el embarque y vuelve a registrar el pago."
      : null,
  (e) => {
    if (e.code !== "23514" && e.code !== "check_violation") return null;
    if (e.message?.includes("aprobada")) {
      return "La factura debe estar aprobada antes de registrar pagos.";
    }
    return e.message?.trim()
      ? `Los datos del pago no cumplen una regla del sistema: ${e.message}`
      : "Los datos del pago no cumplen una regla del sistema.";
  },
];


export function traducirErrorPagoProveedor(err: unknown): string {
  if (!err) return FALLBACK;
  const e = err as ErrorLike;

  for (const regla of REGLAS) {
    const msg = regla(e);
    if (msg) return msg;
  }

  return e.message?.trim() ? `No se pudo registrar el pago: ${e.message}` : FALLBACK;
}
