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

/**
 * Pasos accionables ("qué falta y cómo corregirlo") para los errores de las
 * superficies públicas. Se muestran como lista debajo del mensaje.
 */
export const COPY_PASOS = {
  enlaceInvalido: [
    "Abre el enlace más reciente que te enviamos por correo; los anteriores dejan de funcionar.",
    "Copia y pega la dirección completa: algunos correos la cortan a la mitad.",
    "Si sigue sin abrir, pide un enlace nuevo a tu ejecutivo de cuenta.",
  ],
  enlaceVencido: [
    "Los enlaces vencen por seguridad después de unos días.",
    "Pide a tu ejecutivo de cuenta que te reenvíe el enlace actualizado.",
  ],
  servicioNoDisponible: [
    "Espera un par de minutos y vuelve a cargar la página.",
    "Revisa tu conexión a internet.",
    "Si el problema continúa, avísale a tu ejecutivo de cuenta.",
  ],
  bajaCorreosFalla: [
    "Vuelve a intentar en unos minutos con el mismo enlace.",
    "Si no funciona, responde al correo pidiendo la baja y la aplicamos manualmente.",
  ],
  faltanCampos: [
    "Revisa los campos marcados con * en este paso.",
    "Los campos con mensaje en rojo son los que faltan por capturar.",
  ],
} as const;

/**
 * Estados vacíos de las superficies públicas: qué significa que no haya datos
 * y qué se espera que pase después.
 */
export const COPY_VACIO = {
  eventosTracking: {
    titulo: "Todavía no hay movimientos registrados",
    descripcion:
      "Tu embarque ya está dado de alta, pero aún no recibimos el primer evento de la naviera o del transportista.",
    pasos: [
      "Los movimientos se publican aquí en automático, sin que tengas que hacer nada.",
      "Vuelve a consultar este enlace más adelante para ver los avances.",
      "Si necesitas un dato antes, escríbele a tu ejecutivo de cuenta.",
    ],
  },
} as const;
