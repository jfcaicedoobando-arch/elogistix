/**
 * P1-3b: corte por presupuesto de wall-time en el ejecutor del plan.
 *
 * Cubre: corte determinista con reloj falso, diferidos intactos (sin cursor y
 * sin contarse como errores), fairness del plan intercalado (organizaciones y
 * familias) y que la corrida siempre termina para que el handler suelte el lock.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { crearPresupuesto } from "./presupuesto.ts";
import { planificarTareas, type Tarea } from "./plan.ts";
import { ejecutarPlan, type EjecutarDeps, type ReconcileCtx } from "./ejecutar.ts";
import type { Pendientes } from "./entrada.ts";
import type { FacturaPendiente, NotaCreditoPendiente, RepPendiente } from "./reconcile.ts";

function factura(id: string, org = "org-1"): FacturaPendiente {
  return { id, organization_id: org, facturapi_id: `fapi-${id}`, cancellation_status: "pending", sustituida_por: null };
}
function nc(id: string, org = "org-1"): NotaCreditoPendiente {
  return { id, organization_id: org, facturapi_id: `fapi-${id}`, cancellation_status: "pending" };
}
function rep(id: string, org = "org-1"): RepPendiente {
  return { id, organization_id: org, facturapi_rep_id: `fapi-${id}`, rep_cancellation_status: "pending" };
}

/** Reloj falso: cada lectura avanza `pasoMs`. */
function relojIncremental(pasoMs: number): () => number {
  let t = 0;
  return () => {
    const actual = t;
    t += pasoMs;
    return actual;
  };
}

interface Espia {
  iniciados: string[];
  cursores: string[];
  deps: EjecutarDeps;
}

function armarDeps(presupuestoMs: number, reloj: () => number, fallarOrg?: string): Espia {
  const iniciados: string[] = [];
  const cursores: string[] = [];
  const marcar = async (ctx: ReconcileCtx, id: string) => {
    iniciados.push(id);
    ctx.resumen.revisadas++;
    ctx.resumen.sin_cambio++;
    // Espejo de `marcarRevisado`: sólo documentos realmente iniciados.
    cursores.push(id);
    await Promise.resolve();
  };
  const deps: EjecutarDeps = {
    // SAFE-CAST: el ejecutor sólo reenvía el cliente a los handlers falsos.
    supabase: {} as EjecutarDeps["supabase"],
    presupuesto: crearPresupuesto(presupuestoMs, reloj),
    resolverCliente: (orgId) =>
      Promise.resolve(
        orgId === fallarOrg
          ? { ok: false as const }
          : { ok: true as const, client: { invoices: { retrieve: () => Promise.resolve({}) } }, apiKey: "k" },
      ),
    procesar: {
      factura: (ctx, d) => marcar(ctx, d.id),
      nc: (ctx, d) => marcar(ctx, d.id),
      rep: (ctx, d) => marcar(ctx, d.id),
    },
  };
  return { iniciados, cursores, deps };
}

const pendientes = (p: Partial<Pendientes>): Pendientes => ({
  facturas: p.facturas ?? [],
  notasCredito: p.notasCredito ?? [],
  reps: p.reps ?? [],
});

Deno.test("ejecutor: corta por presupuesto y reporta diferidos (no errores)", async () => {
  const plan = planificarTareas(pendientes({ facturas: ["f1", "f2", "f3", "f4", "f5"].map((i) => factura(i)) }));
  // El reloj avanza 10 ms por lectura y el presupuesto es 25 ms → arranca 3.
  const espia = armarDeps(25, relojIncremental(10));
  const resumen = await ejecutarPlan(plan, espia.deps);

  assertEquals(espia.iniciados, ["f1", "f2", "f3"]);
  assertEquals(resumen.revisadas, 3);
  assertEquals(resumen.diferidos, 2);
  assertEquals(resumen.errores, 0);
});

Deno.test("ejecutor: los diferidos quedan intactos (sin marcar cursor)", async () => {
  const plan = planificarTareas(pendientes({ facturas: ["f1", "f2", "f3", "f4"].map((i) => factura(i)) }));
  const espia = armarDeps(15, relojIncremental(10));
  await ejecutarPlan(plan, espia.deps);

  assertEquals(espia.cursores, ["f1", "f2"]);
  assert(!espia.cursores.includes("f3"));
  assert(!espia.cursores.includes("f4"));
});

Deno.test("ejecutor: sin presupuesto disponible no inicia ningún documento", async () => {
  const plan = planificarTareas(pendientes({ facturas: [factura("f1")], reps: [rep("r1")] }));
  const espia = armarDeps(0, relojIncremental(1));
  const resumen = await ejecutarPlan(plan, espia.deps);

  assertEquals(espia.iniciados, []);
  assertEquals(resumen.diferidos, 2);
  assertEquals(resumen.errores, 0);
});

Deno.test("plan: intercala familias y organizaciones (fairness)", () => {
  const plan = planificarTareas(pendientes({
    facturas: [factura("f1"), factura("f2"), factura("f3", "org-2")],
    notasCredito: [nc("n1")],
    reps: [rep("r1", "org-2")],
  }));
  // Primera ronda: un turno por (org × familia) antes de repetir cualquier cola.
  assertEquals(plan.slice(0, 4).map((t: Tarea) => t.doc.id), ["f1", "n1", "f3", "r1"]);
  assertEquals(plan.at(-1)?.doc.id, "f2");
});

Deno.test("ejecutor: una familia grande no consume el turno de las otras al cortar", async () => {
  const plan = planificarTareas(pendientes({
    facturas: Array.from({ length: 20 }, (_, i) => factura(`f${i}`)),
    notasCredito: [nc("n1")],
    reps: [rep("r1")],
  }));
  const espia = armarDeps(25, relojIncremental(10));
  await ejecutarPlan(plan, espia.deps);

  assert(espia.iniciados.includes("n1"));
  assert(espia.iniciados.includes("r1"));
});

Deno.test("ejecutor: org sin credenciales cuenta error y no aborta la corrida", async () => {
  const plan = planificarTareas(pendientes({
    facturas: [factura("f1", "org-mala"), factura("f2", "org-1")],
  }));
  const espia = armarDeps(10_000, relojIncremental(0), "org-mala");
  const resumen = await ejecutarPlan(plan, espia.deps);

  assertEquals(resumen.errores, 1);
  assertEquals(espia.iniciados, ["f2"]);
});

Deno.test("ejecutor: un handler que lanza no rompe la corrida (el lock se libera)", async () => {
  const plan = planificarTareas(pendientes({ facturas: [factura("f1"), factura("f2")] }));
  const espia = armarDeps(10_000, relojIncremental(0));
  espia.deps.procesar.factura = (_ctx, d) => {
    if (d.id === "f1") throw new Error("boom");
    espia.iniciados.push(d.id);
    return Promise.resolve();
  };
  let liberado = false;
  try {
    const resumen = await ejecutarPlan(plan, espia.deps);
    assertEquals(resumen.errores, 1);
    assertEquals(espia.iniciados, ["f2"]);
  } finally {
    liberado = true;
  }
  assert(liberado);
});
