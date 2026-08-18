/**
 * Mensajes `LC_*` de garantías, demoras y proformas.
 *
 * Consumido por `lcCodeMessages.operativo.ts`.
 */
export const LC_CODE_MESSAGES_OPERATIVO_GARANTIAS: Record<string, string> = {
  // ── Garantías / demoras ────────────────────────────────────────────────
  LC_GARANTIA_NO_ENCONTRADA: "La garantía no existe.",
  LC_GARANTIA_NO_RETENIDA: "La garantía no está en estado retenida.",
  LC_GARANTIA_ORG_MISMATCH: "La garantía pertenece a otra organización.",
  LC_GARANTIA_SIN_ROL: "No tienes permisos para gestionar garantías.",
  LC_GARANTIA_SIN_NAVIERA: "El embarque no tiene naviera asignada.",
  LC_GARANTIA_SIN_PROVEEDOR_NAVIERA:
    "La naviera no tiene un proveedor vinculado en el sistema.",
  LC_GARANTIA_SIN_CATEGORIA_PRESUPUESTO:
    "Falta la categoría de presupuesto para registrar la garantía.",
  LC_GARANTIA_MONTO_REQUERIDO: "Captura el monto de la garantía.",
  LC_GARANTIA_MONTO_CONGELADO:
    "El monto ya está congelado y no puede modificarse.",
  LC_GARANTIA_FECHA_DEPOSITO_REQUERIDA: "Captura la fecha de depósito.",
  LC_GARANTIA_FECHA_LIBERACION_REQUERIDA: "Captura la fecha de liberación.",
  LC_GARANTIA_FACTURA_YA_MATERIALIZADA:
    "La garantía ya fue materializada en una factura y no puede modificarse.",
  LC_GARANTIA_TRANSICION_INVALIDA:
    "La garantía no puede pasar a ese estado desde el actual.",
  LC_DEMORAS_BLOQUEADAS: "Las demoras están bloqueadas para este embarque.",

  // ── Proformas ──────────────────────────────────────────────────────────
  LC_PROFORMA_SIN_PERMISO: "No tienes permisos para modificar esta proforma.",
  LC_PROFORMA_TC_REQUERIDO:
    "Captura el tipo de cambio antes de convertir la proforma.",
  LC_PROFORMA_YA_FACTURADA: "La proforma ya fue facturada.",
  LC_PROFORMA_TOTAL_CERO:
    "La proforma está en ceros: revisa los conceptos antes de marcarla como facturada.",
  LC_PROFORMA_FACTURADA_NO_ELIMINABLE:
    "No puedes eliminar una proforma que ya fue facturada.",
  LC_PROFORMA_MONEDA_NO_SOPORTADA:
    "La moneda de la proforma aún no está soportada para conversión (usa MXN o USD).",
  LC_PROFORMA_ELIMINADA: "Esta proforma fue eliminada y ya no puede modificarse.",
  LC_PROFORMA_REQUIERE_AUTORIZACION:
    "Este cliente sí requiere autorizar sus proformas: envíala y espera su respuesta.",
  LC_TIPO_AUTORIZACION_INVALIDO:
    "Tipo de autorización inválido: usa cotización o proforma.",
};
