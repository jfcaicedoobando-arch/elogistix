/**
 * Helpers puros para los parsers de correos de tarifas.
 * Las filas emitidas usan los mismos encabezados que la importación
 * CSV/Excel para reutilizar `prepararImportacion` y sus validaciones.
 */
import { ALIAS_PUERTOS } from "./proveedoresCorreo";

export interface FilaCorreo {
  Origen: string;
  Destino: string;
  Agente: string;
  Naviera: string;
  "Tarifa 20": number;
  "Tarifa 40": number;
  "Inicio de la vigencia": string;
  "Término de la vigencia": string;
  "Días libres": number;
  Observaciones: string;
}

const MESES: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12",
  jan: "01", apr: "04", aug: "08", dec: "12",
  january: "01", february: "02", march: "03", april: "04", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

/** Año de la cabecera Date del correo (RFC 2822); si falla, el año actual. */
export function anioDelCorreo(fechaHeader: string): number {
  const t = Date.parse(fechaHeader);
  return Number.isNaN(t) ? new Date().getFullYear() : new Date(t).getFullYear();
}

/** Acepta «21-Oct», «21th-October», «21/10» y devuelve AAAA-MM-DD o null. */
export function fechaTextoIso(texto: string, anio: number): string | null {
  const s = texto.trim().replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  const m = /^(\d{1,2})[-/]([A-Za-z]+)/.exec(s);
  if (m) {
    const mes = MESES[m[2].slice(0, 3).toLowerCase()] ?? MESES[m[2].toLowerCase()];
    if (!mes) return null;
    return `${anio}-${mes}-${m[1].padStart(2, "0")}`;
  }
  const n = /^(\d{1,2})[-/](\d{1,2})/.exec(s);
  return n ? `${anio}-${n[2].padStart(2, "0")}-${n[1].padStart(2, "0")}` : null;
}

/**
 * Corta el historial citado del correo: los proveedores responden sobre el
 * hilo y el texto viejo repetiría tarifas vencidas. Se conserva sólo lo
 * anterior al primer marcador de cita («From:» o «El … escribió:»).
 */
export function cortarHistorial(texto: string): string {
  const cortes = [/\nFrom:/i, /\nEl \w{2,3}[.,].*escribió:/i]
    .map((re) => texto.search(re))
    .filter((i) => i > 0);
  return cortes.length ? texto.slice(0, Math.min(...cortes)) : texto;
}

/** Destinos mexicanos mencionados en un texto: Manzanillo y/o Lázaro Cárdenas. */
export function destinosMx(texto: string): string[] {
  const t = texto.toLowerCase();
  const out: string[] = [];
  if (t.includes("manzanillo")) out.push("Manzanillo");
  if (t.includes("lazaro")) out.push("Lázaro Cárdenas");
  return out;
}

export interface FilaCorreoInput {
  origen: string; destino: string; agente: string; naviera: string;
  t20: number; t40: number; desde: string; hasta: string; dias: number; obs?: string;
}

export function filaCorreo(f: FilaCorreoInput): FilaCorreo {
  const origen = ALIAS_PUERTOS[f.origen.trim().toLowerCase()] ?? f.origen;
  return {
    Origen: origen, Destino: f.destino, Agente: f.agente, Naviera: f.naviera,
    "Tarifa 20": f.t20, "Tarifa 40": f.t40,
    "Inicio de la vigencia": f.desde, "Término de la vigencia": f.hasta,
    "Días libres": f.dias, Observaciones: f.obs ?? "",
  };
}
