/**
 * Días festivos oficiales de México (art. 74 de la Ley Federal del Trabajo)
 * calculados en código: sin catálogo en base de datos ni llamadas de red.
 *
 * Sólo informan; ninguna regla de negocio bloquea una fecha inhábil. La UI usa
 * `motivoInhabilMx` para mostrar un aviso ámbar debajo del campo.
 *
 * Todas las funciones operan sobre `YYYY-MM-DD` y derivan el día de la semana
 * con `parseLocalMx` (mediodía UTC) para no correrse un día en runners con
 * zona distinta a CDMX.
 */
import { parseLocalMx } from "./mx";

const DIAS_SEMANA = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
] as const;

/** ISO del n-ésimo día de la semana de un mes (weekday: 0=domingo … 6=sábado). */
function nEsimoDiaSemana(anio: number, mes: number, weekday: number, n: number): string {
  const primero = new Date(Date.UTC(anio, mes - 1, 1, 12));
  const desplazamiento = (weekday - primero.getUTCDay() + 7) % 7;
  const dia = 1 + desplazamiento + (n - 1) * 7;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Año de transmisión del Poder Ejecutivo Federal: 1 de diciembre cada seis
 * años a partir de 2024 (2024, 2030, 2036, …).
 */
export function esAnioTransmisionMx(anio: number): boolean {
  return (anio - 2024) % 6 === 0;
}

/** Mapa `ISO → nombre` de los festivos oficiales del año indicado. */
export function festivosMxDelAnio(anio: number): Map<string, string> {
  const m = new Map<string, string>();
  m.set(`${anio}-01-01`, "Año Nuevo");
  m.set(nEsimoDiaSemana(anio, 2, 1, 1), "Día de la Constitución");
  m.set(nEsimoDiaSemana(anio, 3, 1, 3), "Natalicio de Benito Juárez");
  m.set(`${anio}-05-01`, "Día del Trabajo");
  m.set(`${anio}-09-16`, "Independencia");
  m.set(nEsimoDiaSemana(anio, 11, 1, 3), "Revolución Mexicana");
  if (esAnioTransmisionMx(anio)) {
    m.set(`${anio}-12-01`, "Transmisión del Poder Ejecutivo");
  }
  m.set(`${anio}-12-25`, "Navidad");
  return m;
}

function anioDe(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  return Number(iso.slice(0, 4));
}

/** Nombre del festivo oficial, o `null` si el día es laborable. */
export function nombreFestivoMx(iso: string): string | null {
  const anio = anioDe(iso);
  if (anio === null) return null;
  return festivosMxDelAnio(anio).get(iso.slice(0, 10)) ?? null;
}

export function esFestivoMx(iso: string): boolean {
  return nombreFestivoMx(iso) !== null;
}

/** Nombre del día de la semana en español (`"sábado"`), o `null` si el ISO es inválido. */
export function diaSemanaMx(iso: string): string | null {
  if (anioDe(iso) === null) return null;
  return DIAS_SEMANA[parseLocalMx(iso.slice(0, 10)).getUTCDay()];
}

export function esFinDeSemanaMx(iso: string): boolean {
  if (anioDe(iso) === null) return false;
  const d = parseLocalMx(iso.slice(0, 10)).getUTCDay();
  return d === 0 || d === 6;
}

export function esDiaInhabilMx(iso: string): boolean {
  return esFestivoMx(iso) || esFinDeSemanaMx(iso);
}

/**
 * Texto del aviso ámbar: `"16/09 Independencia"` o `"sábado"`.
 * Devuelve `null` cuando el día es hábil.
 */
export function motivoInhabilMx(iso: string): string | null {
  const festivo = nombreFestivoMx(iso);
  if (festivo) {
    const head = iso.slice(0, 10);
    return `${head.slice(8, 10)}/${head.slice(5, 7)} ${festivo}`;
  }
  if (esFinDeSemanaMx(iso)) return diaSemanaMx(iso);
  return null;
}

/** Siguiente día hábil (excluye fines de semana y festivos oficiales). */
export function siguienteDiaHabilMx(iso: string): string {
  if (anioDe(iso) === null) return iso;
  const d = parseLocalMx(iso.slice(0, 10));
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (esDiaInhabilMx(isoDe(d)));
  return isoDe(d);
}

function isoDe(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
