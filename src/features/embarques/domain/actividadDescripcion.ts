/**
 * P2-A (remate) — Humanización de la descripción y de los campos de `cambios`
 * en la bitácora del embarque.
 *
 * El RPC entrega descripciones principales con la clave técnica dentro del
 * texto (`Factura: factura.borrador_generado`, `Cotización: editar_cotizacion`)
 * y nombres de columna en los cambios (`bl_master`, `etd`). La transformación
 * es conservadora: sólo toca tokens que SON claves técnicas; una descripción
 * ya escrita en lenguaje natural se devuelve intacta.
 */
import { etiquetaEvento, humanizarClave } from "./actividadHumana";

const UUID_GLOBAL =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** `Factura: clave` — prefijo humano corto + clave técnica. */
const PREFIJO_RE = /^([\p{Lu}][\p{L}\s]{2,24}):\s*(\S.*)$/u;

/** Un token sin espacios formado por segmentos snake/dotted: es una clave. */
const CLAVE_TECNICA_RE = /^[a-z0-9]+([._][a-z0-9]+)+$/;

/** Nombres de columna que aparecen en `cambios`, con su etiqueta de negocio. */
const CAMPO_LABEL: Record<string, string> = {
  bl_master: "BL Master",
  bl_hijo: "BL Hijo",
  contenedor: "Contenedor",
  etd: "ETD",
  eta: "ETA",
  fecha_llegada_real: "Llegada real",
  naviera: "Naviera",
  agente_id: "Agente",
  cliente_id: "Cliente",
  tipo_carga: "Tipo de carga",
  puerto_origen: "Puerto de origen",
  puerto_destino: "Puerto de destino",
  peso_kg: "Peso (kg)",
  volumen_m3: "Volumen (m³)",
  estado: "Estado",
  incoterm: "Incoterm",
  observaciones: "Observaciones",
};

export function esClaveTecnica(texto: string): boolean {
  return CLAVE_TECNICA_RE.test(texto.trim());
}

/** Etiqueta de negocio de un campo de `cambios`; el valor original no se toca. */
export function etiquetaCampo(campo: string): string {
  const clave = (campo ?? "").trim();
  if (!clave) return "Campo";
  return CAMPO_LABEL[clave] ?? humanizarClave(clave);
}

/** Sin acentos y en minúsculas, para comparar prefijo vs etiqueta. */
function plano(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function sinUuid(texto: string): string {
  return texto
    .replace(UUID_GLOBAL, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[:·,\-\s]+$/u, "")
    .trim();
}

/**
 * Descripción legible: traduce la clave técnica y suprime el prefijo cuando
 * queda redundante ("Factura: Se generó un borrador de factura").
 */
/** Claves camelCase heredadas ("TipoEvento: Otro · NuevoEstado: X"). */
function sinClavesCamel(texto: string): string {
  return texto
    .replace(/\b(?:TipoEvento|tipoEvento):\s*Otro\s*(?:·\s*)?/g, "")
    .replace(/\b(?:TipoEvento|tipoEvento):/g, "Tipo de evento:")
    .replace(/\b(?:NuevoEstado|nuevoEstado):/g, "Estado nuevo:")
    .replace(/\b(?:DescripcionEvento|descripcionEvento):/g, "Descripción:")
    .trim();
}

export function descripcionHumana(texto: string | null | undefined): string {
  const limpio = sinClavesCamel(sinUuid((texto ?? "").trim()));
  if (!limpio) return "";

  const m = PREFIJO_RE.exec(limpio);
  if (m) {
    const prefijo = m[1].trim();
    const resto = m[2].trim();
    if (!esClaveTecnica(resto)) return limpio;
    const etiqueta = etiquetaEvento(resto);
    return plano(etiqueta).includes(plano(prefijo)) ? etiqueta : `${prefijo}: ${etiqueta}`;
  }

  if (esClaveTecnica(limpio)) return etiquetaEvento(limpio);
  return limpio;
}
