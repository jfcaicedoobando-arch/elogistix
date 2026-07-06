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

const isOrgMismatch = (err: ErrorLike) =>
  err.code === "ORG_MISMATCH" || err.message === "ORG_MISMATCH";

export function traducirErrorPagoProveedor(err: unknown): string {
  if (!err) return "No se pudo registrar el pago. Inténtalo de nuevo.";
  const e = err as ErrorLike;

  if (isOrgMismatch(e)) {
    return "La factura pertenece a otra organización. Cambia a la organización correcta y vuelve a intentarlo.";
  }

  // RLS / permisos
  if (e.code === "42501") {
    return "No tienes permiso para registrar pagos a proveedor en esta organización. Verifica tu rol o la organización activa.";
  }

  // FK ausente
  if (e.code === "23503") {
    return "Falta información relacionada (factura, cuenta bancaria o proveedor). Recarga la página e inténtalo de nuevo.";
  }

  // Unique violation
  if (e.code === "23505") {
    return "Ya existe un pago duplicado con esta referencia.";
  }

  // Sobrepago (trigger check_no_sobrepago_proveedor).
  if (
    e.message &&
    (/SOBREPAGO_PROVEEDOR/i.test(e.message) || /excede el saldo pendiente/i.test(e.message))
  ) {
    return "El pago excede el saldo pendiente de la factura. Revisa los pagos previos y las notas de crédito aplicadas.";
  }

  // CHECK violation (incluye el trigger de aprobación)
  if (e.code === "23514" || e.code === "check_violation") {
    if (e.message && e.message.includes("aprobada")) {
      return "La factura debe estar aprobada antes de registrar pagos.";
    }
    return "Los datos del pago no cumplen una regla del sistema.";
  }

  // Embarque cerrado (excepción del trigger trg_bloquear_cierre)
  if (e.message && /embarque.*cerrado/i.test(e.message)) {
    return "No se puede registrar el pago: el embarque ya está cerrado.";
  }

  return e.message?.trim()
    ? `No se pudo registrar el pago: ${e.message}`
    : "No se pudo registrar el pago. Inténtalo de nuevo.";
}
