/**
 * Parser del Excel de Rainbow (rainbowell.com, «RW RATE.xlsx»). Sólo se lee
 * la hoja CHINA; la tabla de «space on hand» (hoja SPACE) se ignora, igual
 * que las hojas IHC y SPOT RATE. Las celdas combinadas (POL, POD, naviera,
 * fechas) se heredan hacia abajo. De la celda POD sólo se toman los destinos
 * Manzanillo y Lázaro Cárdenas; los recargos («+100/200», Ensenada) se anotan
 * en observaciones sin crear tarifas.
 */
import { AGENTE_CLAVE, NAVIERA_POR_SIGLA } from "./proveedoresCorreo";
import { filaCorreo, type FilaCorreo } from "./comun";
import { fechaIso } from "../importarTarifas";

const AGENTE = AGENTE_CLAVE.rainbow;

const txt = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => {
  const n = Number(txt(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Divide una celda multipuerto («Huangpu\nNansha\n…») en puertos. */
const puertosDe = (celda: string) => celda.split("\n").map((p) => p.trim()).filter(Boolean);

interface EstadoRainbow {
  pol: string; pod: string; carrier: string; dias: number;
  desde: string | null; hasta: string | null;
}

/** Hereda las celdas combinadas del renglón hacia el estado acumulado. */
function heredar(c: unknown[], e: EstadoRainbow): void {
  if (txt(c[0])) e.pol = txt(c[0]);
  if (txt(c[1])) e.pod = txt(c[1]);
  if (txt(c[2])) e.carrier = txt(c[2]);
  const d = /(\d+)/.exec(txt(c[6]));
  if (d) e.dias = Number(d[1]);
  const fDesde = fechaIso(c[7]);
  const fHasta = fechaIso(c[8]);
  if (fDesde) e.desde = fDesde;
  if (fHasta) e.hasta = fHasta;
}

/** Genera las filas del renglón o el motivo por el que se omite. */
function filasDeRenglon(c: unknown[], e: EstadoRainbow, hoyIso: string): { filas: FilaCorreo[]; error: string | null } {
  const t20 = num(c[3]);
  const t40 = num(c[5]) || num(c[4]);
  if (!e.pol || (t20 <= 0 && t40 <= 0)) return { filas: [], error: null };
  const naviera = NAVIERA_POR_SIGLA[e.carrier.toUpperCase()] ?? null;
  if (!naviera) return { filas: [], error: `Rainbow: naviera «${e.carrier}» no reconocida` };
  if (!e.hasta) return { filas: [], error: `Rainbow: renglón de ${e.pol} sin vigencia` };
  const destinos: string[] = [];
  if (/manzanillo/i.test(e.pod)) destinos.push("Manzanillo");
  if (/lazaro/i.test(e.pod)) destinos.push("Lázaro Cárdenas");
  if (destinos.length === 0) return { filas: [], error: `Rainbow: destino «${e.pod.replace(/\n/g, " ")}» no reconocible` };
  const recargo = /\+\s*[\d/]+/.test(e.pod) ? `Recargos por destino: ${e.pod.replace(/\n/g, " ")}` : "";
  const filas: FilaCorreo[] = [];
  for (const o of puertosDe(e.pol)) {
    for (const dest of destinos) {
      filas.push(filaCorreo({ origen: o, destino: dest, agente: AGENTE, naviera, t20, t40, desde: e.desde ?? hoyIso, hasta: e.hasta, dias: e.dias, obs: recargo }));
    }
  }
  return { filas, error: null };
}

export function parsearRainbow(filasXlsx: unknown[][], hoyIso: string): { filas: FilaCorreo[]; errores: string[] } {
  const filas: FilaCorreo[] = [];
  const errores: string[] = [];
  const e: EstadoRainbow = { pol: "", pod: "", carrier: "", dias: 0, desde: null, hasta: null };

  for (const cruda of filasXlsx) {
    const c = Array.isArray(cruda) ? cruda : [];
    if (txt(c[0]).toUpperCase() === "POL") continue; // encabezado de 2 renglones
    heredar(c, e);
    const r = filasDeRenglon(c, e, hoyIso);
    filas.push(...r.filas);
    if (r.error) errores.push(r.error);
  }
  if (filas.length === 0 && errores.length === 0) errores.push("Rainbow: la hoja CHINA no tuvo renglones con tarifa");
  return { filas, errores };
}
