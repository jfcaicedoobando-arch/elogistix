/**
 * Catálogo de rechazos del SAT / FacturApi más frecuentes en timbrado,
 * cancelación y complementos de pago (REP).
 *
 * v13.615.0 (Ola 17) — antes el usuario veía el mensaje crudo de FacturApi
 * (a veces en inglés o con jerga del PAC). Aquí traducimos el código a
 * "qué pasó + qué hacer"; el detalle técnico (código, campo, logId) queda en
 * "Ver detalles" para soporte administrativo.
 */

export interface SatErrorInfo {
  /** Código del SAT (`301`) o de FacturApi (`invalid_customer_tax_id`). */
  codigo: string;
  /** Título corto para el toast (sin jerga técnica). */
  titulo: string;
  /** Qué hacer para resolverlo. */
  accion: string;
}

/** Códigos numéricos del anexo 20 del SAT (validación del CFDI/cancelación). */
const SAT_CODIGOS: Record<string, Omit<SatErrorInfo, "codigo">> = {
  "301": {
    titulo: "El SAT rechazó el XML del CFDI (mal formado)",
    accion: "Revisa los datos fiscales del cliente y los conceptos; si todo se ve correcto, contacta a soporte con el código 301.",
  },
  "302": {
    titulo: "El sello digital del CFDI no es válido",
    accion: "Vuelve a cargar el certificado (.cer/.key) y la contraseña de la organización, luego intenta timbrar de nuevo.",
  },
  "303": {
    titulo: "El certificado de sello digital no corresponde al emisor",
    accion: "Verifica que el CSD cargado sea el del RFC emisor de tu organización.",
  },
  "304": {
    titulo: "El certificado fue revocado o caducó",
    accion: "Tramita un CSD vigente en el SAT y cárgalo en Configuración → Facturación.",
  },
  "305": {
    titulo: "El certificado no es válido para timbrar",
    accion: "Confirma que el CSD sea de sellado (no de e.firma) y que esté vigente.",
  },
  "306": {
    titulo: "La llave usada no es un certificado de sello digital",
    accion: "Sustituye el archivo por el CSD emitido por el SAT.",
  },
  "307": {
    titulo: "El CFDI es duplicado",
    accion: "Ya existe un CFDI vivo con esos mismos datos. Búscalo en el listado antes de volver a timbrar.",
  },
  "401": {
    titulo: "La versión del CFDI no está soportada",
    accion: "Contacta a soporte: la plantilla fiscal debe actualizarse a CFDI 4.0.",
  },
  "402": {
    titulo: "El RFC emisor no está inscrito en el padrón del SAT",
    accion: "Verifica que el RFC de tu organización esté activo y dado de alta para facturar.",
  },
  "403": {
    titulo: "El RFC del receptor no es válido para facturar",
    accion: "Actualiza la constancia de situación fiscal del cliente (RFC, razón social, régimen y código postal deben coincidir exactamente).",
  },
  "404": {
    titulo: "El régimen fiscal o el uso del CFDI no es compatible",
    accion: "Corrige el régimen fiscal del receptor y el uso del CFDI en los datos fiscales del cliente.",
  },
  "702": {
    titulo: "La fecha del CFDI está fuera del rango permitido",
    accion: "El SAT sólo acepta timbrar dentro de las 72 horas siguientes a la fecha del comprobante. Ajusta la fecha del documento.",
  },
  "708": {
    titulo: "El código postal del receptor no coincide con el padrón",
    accion: "Corrige el código postal del domicilio fiscal del cliente según su constancia de situación fiscal.",
  },
  "CFDI33101": {
    titulo: "Los impuestos del CFDI no cuadran",
    accion: "Revisa el IVA y las retenciones de los conceptos; la suma debe coincidir con los totales.",
  },
  "CFDI40147": {
    titulo: "Los impuestos del CFDI no cuadran",
    accion: "Revisa el IVA, las retenciones y las claves del SAT de cada concepto.",
  },
};

/** Errores de cancelación (servicio de cancelación del SAT). */
const SAT_CANCELACION: Record<string, Omit<SatErrorInfo, "codigo">> = {
  "201": {
    titulo: "El CFDI ya estaba cancelado",
    accion: "Sincroniza el estado con el SAT para reflejar la cancelación en el sistema.",
  },
  "202": {
    titulo: "El CFDI no se puede cancelar sin autorización del receptor",
    accion: "El SAT envió la solicitud al receptor: tiene 72 horas para aceptarla. Consulta el estado más tarde.",
  },
  "203": {
    titulo: "El folio fiscal no existe o no pertenece al emisor",
    accion: "Verifica el UUID del CFDI y que corresponda al RFC emisor de tu organización.",
  },
  "205": {
    titulo: "El folio fiscal no existe en el SAT",
    accion: "Confirma que el CFDI se timbró correctamente antes de cancelarlo.",
  },
};

/** Códigos de error propios de FacturApi (no del SAT). */
const FACTURAPI_CODIGOS: Record<string, Omit<SatErrorInfo, "codigo">> = {
  invalid_certificate: {
    titulo: "El certificado de sello digital no se pudo usar",
    accion: "Vuelve a cargar el .cer, el .key y la contraseña en Configuración → Facturación.",
  },
  missing_certificate: {
    titulo: "Falta el certificado de sello digital",
    accion: "Carga el CSD de tu organización en Configuración → Facturación antes de timbrar.",
  },
  invalid_customer_tax_id: {
    titulo: "El RFC del cliente no es válido",
    accion: "Corrige el RFC en los datos fiscales del cliente (12 o 13 caracteres, sin espacios).",
  },
  customer_tax_info_mismatch: {
    titulo: "Los datos fiscales del cliente no coinciden con el SAT",
    accion: "Captura razón social, régimen y código postal exactamente como aparecen en su constancia de situación fiscal.",
  },
  insufficient_funds: {
    titulo: "No hay folios/timbres disponibles",
    accion: "Recarga timbres con tu proveedor de facturación e intenta de nuevo.",
  },
  authentication_error: {
    titulo: "Las credenciales de facturación no son válidas",
    accion: "Revisa la llave de FacturApi configurada para tu organización.",
  },
  rate_limit_exceeded: {
    titulo: "Demasiadas solicitudes de facturación seguidas",
    accion: "Espera un minuto e intenta de nuevo.",
  },
};

/**
 * Busca un código (SAT o FacturApi) en el catálogo. Devuelve `null` si no está
 * registrado, para que el llamador use el mensaje original.
 */
export function buscarCodigoSat(codigo: string | null | undefined): SatErrorInfo | null {
  if (!codigo) return null;
  const clave = codigo.trim();
  const upper = clave.toUpperCase();
  const lower = clave.toLowerCase();
  const info = SAT_CODIGOS[upper] ?? SAT_CANCELACION[upper] ?? FACTURAPI_CODIGOS[lower];
  return info ? { codigo: clave, ...info } : null;
}

/**
 * Extrae un código del SAT de un texto libre (`"CFDI40147 - ..."`,
 * `"El SAT respondió 402"`). Sólo reconoce códigos del catálogo para no
 * confundir montos o folios con códigos de error.
 */
export function extraerCodigoSatDeTexto(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const cfdi = texto.match(/\bCFDI\s?(\d{5})\b/i);
  if (cfdi && SAT_CODIGOS[`CFDI${cfdi[1]}`]) return `CFDI${cfdi[1]}`;
  const num = texto.match(/\b([2-7]\d{2})\b/g) ?? [];
  for (const n of num) {
    if (SAT_CODIGOS[n] || SAT_CANCELACION[n]) return n;
  }
  return null;
}
