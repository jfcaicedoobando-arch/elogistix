/**
 * Parser de los correos de Longsail (longsailing.net): dos tablas de texto
 * sin separadores (el texto plano pega las columnas).
 *  1) «MSK SPOT»: Yantian5061558621daysMSK SPOT29-Oct33-35 days around
 *  2) «Booking instruction»: SHENZHENMANZANILLO /LAZARO4950495019-OctPI'20General cargo…
 * Las siglas de naviera con apóstrofe (W', I', Z', T', MS', C', Y', E', O')
 * se traducen con NAVIERA_POR_SIGLA.
 */
import { AGENTE_CLAVE, NAVIERA_POR_SIGLA, PUERTOS_ORIGEN_CORREO } from "./proveedoresCorreo";
import { cortarHistorial, fechaTextoIso, filaCorreo, type FilaCorreo } from "./comun";

const AGENTE = AGENTE_CLAVE.longsail;
const PUERTOS = PUERTOS_ORIGEN_CORREO.map((p) => p.replace(" ", "\\s?")).join("|");
const DESTINOS = ["Manzanillo", "Lázaro Cárdenas"];

// Las tarifas vienen pegadas al texto («Yantian5061558621days» = 5061 / 5586 / 21 días),
// por eso se toman exactamente 4 dígitos por tarifa.
const RE_SPOT = new RegExp(
  `^(${PUERTOS})(\\d{4})(\\d{4})(\\d+)days([A-Za-z' ]+?)(\\d{1,2}-[A-Za-z]{3}.*)$`, "i");
const RE_BOOKING = new RegExp(
  `^(${PUERTOS})(MANZANILLO|LAZARO)[^0-9]*?(\\d{4})(\\d{4})(\\d{1,2}-[A-Za-z]{3})([A-Z' /]+?)(\\d{2})General`, "i");

function navieraDeSiglas(siglas: string): string | null {
  const primera = siglas.replace(/'/g, "").trim().split(/[\s/]+/)[0]?.toUpperCase() ?? "";
  return NAVIERA_POR_SIGLA[primera] ?? null;
}

function vigencia(texto: string, anio: number): { desde: string | null; hasta: string | null } {
  const m = /VALIDITY:\s*From\s+(\d{1,2}-[A-Za-z]{3})\s+to\s+(\d{1,2}-[A-Za-z]{3})/i.exec(texto);
  return m
    ? { desde: fechaTextoIso(m[1], anio), hasta: fechaTextoIso(m[2], anio) }
    : { desde: null, hasta: null };
}

function filasSpot(spot: RegExpExecArray, vig: { hasta: string | null }, desde: string, anio: number): { filas: FilaCorreo[]; error: string | null } {
  const hasta = vig.hasta ?? fechaTextoIso(spot[6], anio);
  if (!hasta) return { filas: [], error: `Longsail: renglón SPOT de ${spot[1]} sin vigencia` };
  return {
    filas: DESTINOS.map((d) => filaCorreo({ origen: spot[1], destino: d, agente: AGENTE, naviera: "MAEU", t20: Number(spot[2]), t40: Number(spot[3]),
      desde, hasta, dias: Number(spot[4]), obs: `MSK SPOT. ETD ${spot[6].trim()}` })),
    error: null,
  };
}

function destinosBooking(linea: string, bk: RegExpExecArray): string[] {
  const segmento = linea.slice(0, linea.indexOf(bk[3]));
  const man = /manzanillo/i.test(segmento);
  const laz = /lazaro/i.test(segmento);
  if (man && laz) return DESTINOS;
  return [laz && !man ? "Lázaro Cárdenas" : "Manzanillo"];
}

function filasBooking(bk: RegExpExecArray, linea: string, vig: { hasta: string | null }, desde: string, anio: number): { filas: FilaCorreo[]; error: string | null } {
  const naviera = navieraDeSiglas(bk[6]);
  if (!naviera) return { filas: [], error: `Longsail: naviera «${bk[6].trim()}» no reconocida` };
  const hasta = vig.hasta ?? fechaTextoIso(bk[5], anio) ?? desde;
  return {
    filas: destinosBooking(linea, bk).map((d) => filaCorreo({ origen: bk[1], destino: d, agente: AGENTE, naviera, t20: Number(bk[3]), t40: Number(bk[4]),
      desde, hasta, dias: Number(bk[7]), obs: `ETD ${bk[5]}. Naviera: ${bk[6].trim()}` })),
    error: null,
  };
}

export function parsearLongsail(texto: string, anio: number, hoyIso: string): { filas: FilaCorreo[]; errores: string[] } {
  const cuerpo = cortarHistorial(texto);
  const vig = vigencia(cuerpo, anio);
  const desde = vig.desde ?? hoyIso;
  const filas: FilaCorreo[] = [];
  const errores: string[] = [];

  for (const cruda of cuerpo.split("\n")) {
    const linea = cruda.trim();
    const spot = RE_SPOT.exec(linea);
    const bk = spot ? null : RE_BOOKING.exec(linea);
    const r = spot ? filasSpot(spot, vig, desde, anio) : bk ? filasBooking(bk, linea, vig, desde, anio) : null;
    if (!r) continue;
    filas.push(...r.filas);
    if (r.error) errores.push(r.error);
  }
  if (filas.length === 0 && errores.length === 0) errores.push("Longsail: no se encontraron renglones de tarifas");
  return { filas, errores };
}
