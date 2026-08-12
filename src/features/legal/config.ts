/**
 * UIB-08: el contenido legal (aviso de privacidad, términos) es BORRADOR y
 * requiere revisión/aprobación de asesoría legal (insumo humano — el código
 * no lo sustituye). Mientras este flag sea `false`, las páginas /legal/*
 * muestran un aviso "en revisión" SIN el texto borrador. Al recibir los
 * textos aprobados: pegarlos en Privacidad.tsx / Terminos.tsx (incluyendo el
 * domicilio del responsable, obligatorio LFPDPPP art. 16) y voltear a `true`.
 */
export const LEGAL_CONTENT_APPROVED = false;

/** Contacto mostrado mientras el contenido legal está en revisión. */
export const LEGAL_CONTACT_EMAIL = "contacto@librecarga.com";
