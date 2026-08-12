/**
 * Copy único de las superficies públicas (sin sesión o de cliente externo):
 * tracking público, portal de proformas, baja de correos, portal del cliente
 * y páginas legales.
 *
 * Regla: español mexicano, trato de "tú", una sola redacción por concepto para
 * que el mensaje sea idéntico en todos los pasos del flujo. Nunca exponer
 * códigos técnicos ni `error.message` crudo en estas vistas.
 */

/** Enlaces con token (tracking, proforma, baja de correos). */
export const COPY_ENLACE = {
  /** Token inexistente, revocado o vencido. */
  invalido: "Este enlace ya no es válido o venció. Solicita uno nuevo a tu ejecutivo de cuenta.",
  /** Falla temporal de infraestructura. */
  noDisponible:
    "El servicio no está disponible en este momento. Vuelve a intentarlo en unos minutos.",
} as const;

/** Mensajes de validación de formularios públicos. */
export const COPY_VALIDACION = {
  /** Campo obligatorio vacío. `campo` en minúsculas: "el origen". */
  requerido: (campo: string) => `Captura ${campo} para continuar.`,
  /** Falta capturar uno o más campos obligatorios del paso actual. */
  camposObligatorios: "Completa los campos marcados con * para continuar.",
  /** Motivo de rechazo demasiado corto. */
  motivoRechazo: "Escribe el motivo del rechazo (al menos 3 caracteres).",
} as const;

/** Textos de marca y pie de página de vistas públicas. */
export const COPY_PIE = {
  tecnologia: "Con tecnología de",
  seguimientoTitulo: "Seguimiento de embarque",
  seguimientoSubtitulo: "Seguimiento en tiempo real",
} as const;

/** Baja de correos (`/unsubscribe`). */
export const COPY_BAJA_CORREOS = {
  titulo: "Cancelar suscripción",
  validando: "Estamos validando tu enlace…",
  yaDadoDeBaja: "Esta dirección ya estaba dada de baja.",
  confirmar: "¿Confirmas que quieres dejar de recibir correos de Libre Carga?",
  procesando: "Estamos procesando tu solicitud…",
  exito: "Listo. Ya no recibirás más correos nuestros.",
  falla: "No pudimos procesar tu baja. Vuelve a intentarlo en unos minutos.",
} as const;

/** Páginas legales mientras el contenido está en revisión. */
export const COPY_LEGAL = {
  enRevision: "Este documento está en revisión legal y se publicará próximamente.",
  contacto: "Si tienes dudas sobre el tratamiento de tus datos personales, escríbenos a",
} as const;
