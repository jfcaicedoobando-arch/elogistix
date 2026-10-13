/**
 * Parser de los correos de Oriental (oriental-log.com): bloques numerados
 * «1. POL: … POD: Manzanillo/Lazaro Cardenas Rate: USD4350/4850; 20GP/40HQ
 * Carrier: TSL 21 days free time Validity time from 19th-Oct till 25th-Oct».
 */
import { AGENTE_CLAVE, NAVIERA_POR_SIGLA } from "./proveedoresCorreo";
import { cortarHistorial, destinosMx, fechaTextoIso, filaCorreo, type FilaCorreo } from "./comun";

const AGENTE = AGENTE_CLAVE.oriental;

function navieraDe(texto: string): { codigo: string | null; original: string } {
  const original = texto.trim();
  const primera = original.split("/")[0].trim().toUpperCase();
  return { codigo: NAVIERA_POR_SIGLA[primera] ?? null, original };
}

interface CamposBloque {
  t20: number; t40: number; navCodigo: string; navOriginal: string;
  desde: string; hasta: string; dias: number; pol: string;
}

/** Lee los campos del bloque; devuelve null con el motivo cuando falta algo. */
function leerCampos(bloque: string, anio: number, hoyIso: string): { campos: CamposBloque | null; error: string | null } {
  const pol = /POL:\s*(.+)/i.exec(bloque)?.[1] ?? "";
  const rate = /Rate:\s*USD\s*([\d,]+)\s*\/\s*([\d,]+)/i.exec(bloque);
  if (!rate) return { campos: null, error: "bloque sin tarifa reconocible" };
  const nav = navieraDe(/Carrier:\s*(.+)/i.exec(bloque)?.[1] ?? "");
  if (!nav.codigo) return { campos: null, error: `naviera «${nav.original}» no reconocida` };
  const vig = /Validity\s*time\s*from\s+(.+?)\s+till\s+(.+?)\s*$/im.exec(bloque);
  const hasta = vig ? fechaTextoIso(vig[2], anio) : null;
  if (!hasta) return { campos: null, error: "vigencia no reconocible" };
  return {
    campos: {
      t20: Number(rate[1].replace(/,/g, "")), t40: Number(rate[2].replace(/,/g, "")),
      navCodigo: nav.codigo, navOriginal: nav.original,
      desde: (vig && fechaTextoIso(vig[1], anio)) ?? hoyIso, hasta,
      dias: Number(/(\d+)\s*days?\s*free/i.exec(bloque)?.[1] ?? 0), pol,
    },
    error: null,
  };
}

function parsearBloque(bloque: string, anio: number, hoyIso: string): { filas: FilaCorreo[]; error: string | null } {
  const pod = /POD:\s*(.+)/i.exec(bloque)?.[1] ?? "";
  const destinos = destinosMx(pod);
  const { campos, error } = leerCampos(bloque, anio, hoyIso);
  if (!campos) return { filas: [], error };
  if (destinos.length === 0) return { filas: [], error: "destino no reconocible" };

  // Los puertos tras «+USD150/150 …» llevan recargo; se omiten y se anota.
  const [base, recargo] = campos.pol.split("+USD");
  const obs = [
    campos.navOriginal.includes("/") ? `Navieras: ${campos.navOriginal}` : "",
    recargo ? `Recargo en otros puertos: +USD${recargo.trim()}` : "",
  ].filter(Boolean).join(". ");

  const filas: FilaCorreo[] = [];
  for (const o of base.split("/").map((p) => p.trim()).filter(Boolean)) {
    for (const d of destinos) {
      filas.push(filaCorreo({ origen: o, destino: d, agente: AGENTE, naviera: campos.navCodigo, t20: campos.t20, t40: campos.t40, desde: campos.desde, hasta: campos.hasta, dias: campos.dias, obs }));
    }
  }
  return { filas, error: null };
}

export function parsearOriental(texto: string, anio: number, hoyIso: string): { filas: FilaCorreo[]; errores: string[] } {
  const cuerpo = cortarHistorial(texto);
  const bloques = cuerpo.split(/^\s*\d+\s*[.:l]?\s*$/m).map((b) => b.trim()).filter((b) => /POL:/i.test(b));
  const filas: FilaCorreo[] = [];
  const errores: string[] = [];
  bloques.forEach((b, i) => {
    const r = parsearBloque(b, anio, hoyIso);
    filas.push(...r.filas);
    if (r.error) errores.push(`Oriental bloque ${i + 1}: ${r.error}`);
  });
  if (filas.length === 0 && errores.length === 0) errores.push("Oriental: no se encontraron bloques de tarifas");
  return { filas, errores };
}
