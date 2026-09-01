/**
 * P1-3b: plan de ejecución intercalado (round-robin) de la corrida del cron.
 *
 * Antes el barrido recorría organización por organización y, dentro de cada
 * una, familia por familia (todas las facturas, luego todas las NC, luego los
 * REP). Con corte por wall-time eso volvería a producir inanición: la primera
 * organización (y su primera familia) se comería el presupuesto y el resto
 * quedaría sin turno corrida tras corrida.
 *
 * `planificarTareas` aplana los pendientes en una sola lista donde cada vuelta
 * da un turno a cada (organización × familia). Cortar el plan por presupuesto
 * en cualquier punto conserva la equidad: nadie avanza dos posiciones antes de
 * que los demás avancen una.
 */
import type { FacturaPendiente, NotaCreditoPendiente, RepPendiente } from "./reconcile.ts";
import { agruparPorOrg } from "./reconcile.ts";
import type { Pendientes } from "./entrada.ts";

export type Familia = "factura" | "nc" | "rep";

export type Tarea =
  | { orgId: string; familia: "factura"; doc: FacturaPendiente }
  | { orgId: string; familia: "nc"; doc: NotaCreditoPendiente }
  | { orgId: string; familia: "rep"; doc: RepPendiente };

interface ColasOrg {
  factura: FacturaPendiente[];
  nc: NotaCreditoPendiente[];
  rep: RepPendiente[];
}

const FAMILIAS: Familia[] = ["factura", "nc", "rep"];

function colasPorOrg(pendientes: Pendientes): Map<string, ColasOrg> {
  const facturas = agruparPorOrg(pendientes.facturas);
  const ncs = agruparPorOrg(pendientes.notasCredito as unknown as FacturaPendiente[]);
  const reps = agruparPorOrg(pendientes.reps as unknown as FacturaPendiente[]);
  const orgIds = [...new Set<string>([...facturas.keys(), ...ncs.keys(), ...reps.keys()])];

  const colas = new Map<string, ColasOrg>();
  for (const orgId of orgIds) {
    colas.set(orgId, {
      factura: facturas.get(orgId) ?? [],
      nc: (ncs.get(orgId) ?? []) as unknown as NotaCreditoPendiente[],
      rep: (reps.get(orgId) ?? []) as unknown as RepPendiente[],
    });
  }
  return colas;
}

/** Aplana los pendientes intercalando organizaciones y familias. */
export function planificarTareas(pendientes: Pendientes): Tarea[] {
  const colas = colasPorOrg(pendientes);
  const tareas: Tarea[] = [];
  let i = 0;
  let quedan = true;
  while (quedan) {
    quedan = false;
    for (const [orgId, cola] of colas) {
      for (const familia of FAMILIAS) {
        const doc = cola[familia][i];
        if (!doc) continue;
        quedan = true;
        tareas.push({ orgId, familia, doc } as Tarea);
      }
    }
    i++;
  }
  return tareas;
}
