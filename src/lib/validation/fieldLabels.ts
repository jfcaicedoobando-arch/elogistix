/**
 * Catálogo de etiquetas legibles en español para campos de mutaciones.
 *
 * `parseOrThrow` (mutationSchemas.ts) antes anteponía el `path` crudo de Zod
 * (p. ej. `descripcion_mercancia:`) a los mensajes de error. Este catálogo
 * traduce las claves conocidas y, para las que no estén catalogadas, aplica
 * un fallback que convierte snake_case en texto capitalizado legible.
 */

const FIELD_LABELS: Record<string, string> = {
  nombre: "Nombre",
  rfc: "RFC",
  email: "Correo",
  telefono: "Teléfono",
  contacto: "Contacto",
  ciudad: "Ciudad",
  estado: "Estado",
  cp: "Código postal",
  direccion: "Dirección",
  dias_credito: "Días de crédito",
  limite_credito_mxn: "Límite de crédito",
  regimen_fiscal: "Régimen fiscal",
  uso_cfdi_default: "Uso de CFDI",
  requiere_autorizacion_cotizacion: "Requiere autorización de cotización",
  requiere_autorizacion_proforma: "Requiere autorización de proforma",
  organization_id: "Organización",
  cliente_nombre: "Cliente",
  cliente_id: "Cliente",
  es_prospecto: "Prospecto",
  modo: "Modo",
  tipo: "Tipo",
  incoterm: "Incoterm",
  descripcion_mercancia: "Descripción de la mercancía",
  origen: "Origen",
  destino: "Destino",
  moneda: "Moneda",
  vigencia_dias: "Vigencia",
  subtotal: "Subtotal",
  total: "Total",
  iva: "IVA",
  tipo_cambio: "Tipo de cambio",
  conceptos_venta: "Conceptos de venta",
  descripcion: "Descripción",
  cantidad: "Cantidad",
  precio_unitario: "Precio unitario",
  operador: "Operador",
  tipo_carga: "Tipo de carga",
  expediente: "Expediente",
  contenido: "Contenido",
  usuario: "Usuario",
  fecha: "Fecha",
  ubicacion: "Ubicación",
};

/** Convierte `snake_case` (o rutas `a.b.c`) en texto capitalizado legible. */
function humanizeSnakeCase(raw: string): string {
  const lastSegment = raw.split(".").pop() ?? raw;
  const withSpaces = lastSegment.replace(/_/g, " ").trim();
  if (!withSpaces) return raw;
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

/**
 * Devuelve la etiqueta legible para un `path` de Zod (posiblemente anidado,
 * p. ej. `conceptos_venta.0.cantidad`). Usa el catálogo por el último
 * segmento no numérico; si no está catalogado, humaniza el snake_case.
 */
export function getFieldLabel(path: string): string {
  const segments = path.split(".").filter((seg) => seg !== "" && !/^\d+$/.test(seg));
  const key = segments[segments.length - 1] ?? path;
  return FIELD_LABELS[key] ?? humanizeSnakeCase(key);
}
