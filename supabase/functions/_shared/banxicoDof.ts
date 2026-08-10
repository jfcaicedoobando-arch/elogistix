/**
 * banxicoDof — lógica compartida para obtener el TC de Publicación DOF
 * (USD/EUR → MXN) desde la API SIE de Banxico.
 *
 * Extraído de `exchange-rates/index.ts` (v13.335.0) para reutilizarlo en el
 * cron diario `tc-dof-diario` sin duplicar reglas fiscales.
 *
 * Series:
 *   - SF43718 → USD/MXN FIX. La Publicación DOF vigente HOY es el FIX del
 *     último día hábil ANTERIOR (Art. 20 CFF).
 *   - SF46410 → EUR/MXN determinado por Banxico.
 */

export const SERIE_USD = "SF43718";
export const SERIE_EUR = "SF46410";
export const RANGO_DIAS = 10; // cubre fines de semana y feriados

export interface BanxicoDato { fecha: string; dato: string }
export interface BanxicoResponse {
  bmx?: { series?: Array<{ idSerie?: string; datos?: BanxicoDato[] }> };
}

/**
 * Último dato numérico válido de la serie (sin filtrar por fecha).
 * NO usar para CFDI: puede devolver el FIX de HOY, que es DOF de mañana.
 */
export function extraerUltimoTC(data: BanxicoResponse): number | null {
  const datos = data?.bmx?.series?.[0]?.datos ?? [];
  for (let i = datos.length - 1; i >= 0; i--) {
    const num = Number(datos[i]?.dato);
    if (Number.isFinite(num) && num > 0) return +num.toFixed(4);
  }
  return null;
}

/** Convierte `DD/MM/YYYY` de Banxico a `YYYY-MM-DD`; `null` si no aplica. */
export function filaFechaIso(fecha: string | undefined): string | null {
  const partes = (fecha ?? "").split("/");
  if (partes.length !== 3) return null;
  const [dd, mm, yyyy] = partes;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/**
 * Publicación DOF vigente para `hoyIso`: la última fila con fecha ESTRICTAMENTE
 * anterior a `hoyIso` y valor numérico positivo.
 */
export function extraerPublicacionDof(
  data: BanxicoResponse,
  hoyIso: string,
): { tc: number | null; fechaAplicada?: string } {
  const datos = data?.bmx?.series?.[0]?.datos ?? [];
  for (let i = datos.length - 1; i >= 0; i--) {
    const filaIso = filaFechaIso(datos[i]?.fecha);
    if (!filaIso || filaIso >= hoyIso) continue;
    const num = Number(datos[i].dato);
    if (Number.isFinite(num) && num > 0) {
      return { tc: +num.toFixed(4), fechaAplicada: filaIso };
    }
  }
  return { tc: null };
}

/** Formatea `Date` como `YYYY-MM-DD` usando componentes UTC. */
export function formatFechaBanxico(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * N14 (Ola 4): día civil en America/Mexico_City. La fecha fiscal mexicana
 * (Art. 20 CFF) es la del horario local: entre 18:00 y 23:59 CST el día UTC
 * ya es "mañana" y cualquier corte/llave calculado en UTC queda desfasado.
 * Usar SIEMPRE esta función como corte de `extraerPublicacionDof` y como
 * llave de `tipos_cambio_dof`; `formatFechaBanxico` (UTC) queda sólo para
 * acotar rangos de consulta a la API SIE, donde ±1 día es inocuo.
 */
export function isoDiaMexico(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(d);
}

/** Rango `{inicio, fin}` de los últimos `dias` días para la consulta SIE. */
export function rangoUltimosDias(
  hoy: Date,
  dias: number = RANGO_DIAS,
): { inicio: string; fin: string } {
  const inicio = new Date(hoy);
  inicio.setUTCDate(inicio.getUTCDate() - dias);
  return { inicio: formatFechaBanxico(inicio), fin: formatFechaBanxico(hoy) };
}

async function pedirSerie(
  serie: string,
  ruta: string,
  token: string,
  signal?: AbortSignal,
): Promise<BanxicoResponse> {
  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${serie}/datos/${ruta}`;
  const res = await fetch(url, {
    headers: { "Bmx-Token": token, "Accept": "application/json" },
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`banxico ${serie} ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as BanxicoResponse;
}

/** USD DOF vigente para `fechaObjetivo` (rango de 10 días + filtro `< fecha`). */
export async function fetchUsdDof(
  token: string,
  signal: AbortSignal | undefined,
  fechaObjetivo: Date,
): Promise<{ tc: number | null; fechaAplicada?: string }> {
  const { inicio, fin } = rangoUltimosDias(fechaObjetivo);
  const json = await pedirSerie(SERIE_USD, `${inicio}/${fin}`, token, signal);
  // N14 (Ola 4): el corte es el día civil MX, no el UTC (ver isoDiaMexico).
  return extraerPublicacionDof(json, isoDiaMexico(fechaObjetivo));
}

/**
 * EUR: SF46410 no soporta rango para "hoy" (404), sólo `oportuno`.
 * Para fecha histórica intenta rango y devuelve `null` si no hay dato.
 */
export async function fetchEurBanxico(
  token: string,
  signal: AbortSignal | undefined,
  fechaObjetivo: Date,
  esHoy: boolean,
): Promise<number | null> {
  if (esHoy) {
    const json = await pedirSerie(SERIE_EUR, "oportuno", token, signal);
    return extraerUltimoTC(json);
  }
  try {
    const { inicio, fin } = rangoUltimosDias(fechaObjetivo);
    const json = await pedirSerie(SERIE_EUR, `${inicio}/${fin}`, token, signal);
    // N14 (Ola 4): el corte es el día civil MX, no el UTC (ver isoDiaMexico).
    return extraerPublicacionDof(json, isoDiaMexico(fechaObjetivo)).tc;
  } catch {
    return null;
  }
}
