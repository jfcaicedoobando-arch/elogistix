/**
 * Parser de los correos de Golden (szgolden-shipping.com): tabla de texto
 * «SSL POL MANZANILLO/LAZARO ENSENADA Free time Valid» con renglones
 * «CMA Base Ports 5600 5900 / / 21 days 21-Oct». «Base Ports» se expande a
 * los 9 puertos acordados; los renglones sin POL heredan el anterior y los
 * sin vigencia/días heredan los del primer renglón.
 */
import { AGENTE_CLAVE, GOLDEN_BASE_PORTS, NAVIERA_POR_SIGLA } from "./proveedoresCorreo";
import { cortarHistorial, fechaTextoIso, filaCorreo, type FilaCorreo } from "./comun";

const AGENTE = AGENTE_CLAVE.golden;
const DESTINOS_BASE = ["Manzanillo", "Lázaro Cárdenas"];

const RENGLON = /^([A-Z]{2,4})(\s+Base\s+Ports)?\s+(\d+|\/)\s+(\d+|\/)\s+(\d+|\/)\s+(\d+|\/)(\s+(\d+)\s*days)?(\s+(\d{1,2})-([A-Za-z]{3}))?/i;

const num = (v: string) => (v === "/" ? 0 : Number(v));

interface EstadoGolden { puertos: readonly string[]; dias: number; hasta: string | null }

/** Procesa un renglón de la tabla; actualiza el estado heredado y devuelve filas o error. */
function procesarRenglon(m: RegExpExecArray, estado: EstadoGolden, anio: number, hoyIso: string): { filas: FilaCorreo[]; error: string | null } {
  const naviera = NAVIERA_POR_SIGLA[m[1].toUpperCase()];
  if (!naviera) return { filas: [], error: `Golden: naviera «${m[1]}» no reconocida` };
  if (m[2]) estado.puertos = GOLDEN_BASE_PORTS;
  if (m[8]) estado.dias = Number(m[8]);
  if (m[10]) estado.hasta = fechaTextoIso(`${m[10]}-${m[11]}`, anio);
  if (estado.puertos.length === 0 || !estado.hasta) {
    return { filas: [], error: `Golden: renglón de ${m[1]} sin puertos o vigencia` };
  }
  const pares: [number, number, string[]][] = [
    [num(m[3]), num(m[4]), DESTINOS_BASE],
    [num(m[5]), num(m[6]), ["Ensenada"]],
  ];
  const filas: FilaCorreo[] = [];
  for (const [t20, t40, destinos] of pares) {
    if (t20 <= 0 && t40 <= 0) continue;
    for (const o of estado.puertos) {
      for (const d of destinos) {
        filas.push(filaCorreo({ origen: o, destino: d, agente: AGENTE, naviera, t20, t40, desde: hoyIso, hasta: estado.hasta, dias: estado.dias }));
      }
    }
  }
  return { filas, error: null };
}

export function parsearGolden(texto: string, anio: number, hoyIso: string): { filas: FilaCorreo[]; errores: string[] } {
  const lineas = cortarHistorial(texto).split("\n");
  const inicio = lineas.findIndex((l) => /SSL\s+POL\s+MANZANILLO/i.test(l));
  if (inicio < 0) return { filas: [], errores: ["Golden: no se encontró la tabla de tarifas"] };

  const filas: FilaCorreo[] = [];
  const errores: string[] = [];
  const estado: EstadoGolden = { puertos: [], dias: 0, hasta: null };

  for (const cruda of lineas.slice(inicio + 1)) {
    const linea = cruda.trim();
    if (linea === "" || /^(hope|tks|best|saludos|dear)/i.test(linea)) break;
    const m = RENGLON.exec(linea);
    if (!m) continue;
    const r = procesarRenglon(m, estado, anio, hoyIso);
    filas.push(...r.filas);
    if (r.error) errores.push(r.error);
  }
  if (filas.length === 0 && errores.length === 0) errores.push("Golden: la tabla no tuvo renglones con tarifa");
  return { filas, errores };
}
