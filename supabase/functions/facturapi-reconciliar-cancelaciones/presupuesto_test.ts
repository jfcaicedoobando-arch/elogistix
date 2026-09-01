/**
 * P1-3b: presupuesto de wall-time con reloj inyectable (determinista).
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  crearPresupuesto,
  CRON_RETRIEVE_TIMEOUT_MS,
  LIMITE_RUNTIME_MS,
  PRESUPUESTO_WALL_MS,
} from "./presupuesto.ts";

function relojFalso(valores: number[]): () => number {
  let i = 0;
  return () => valores[Math.min(i++, valores.length - 1)];
}

Deno.test("presupuesto: no está agotado antes del límite", () => {
  const p = crearPresupuesto(1000, relojFalso([0, 500, 999]));
  assertEquals(p.agotado(), false);
  assertEquals(p.restanteMs(), 1);
});

Deno.test("presupuesto: se agota exactamente al alcanzar el límite", () => {
  const p = crearPresupuesto(1000, relojFalso([0, 1000, 5000]));
  assertEquals(p.agotado(), true);
  assertEquals(p.restanteMs(), 0);
});

Deno.test("presupuesto: el margen elegido cabe en el límite de runtime asumido", () => {
  // 95 s de corte + peor caso de un documento iniciado (retrieve + acuse + BD)
  // debe quedar por debajo del wall-time asumido, con margen para responder.
  const peorDocumento = CRON_RETRIEVE_TIMEOUT_MS + 12_000 + 5_000;
  assert(PRESUPUESTO_WALL_MS + peorDocumento < LIMITE_RUNTIME_MS);
  assert(LIMITE_RUNTIME_MS - (PRESUPUESTO_WALL_MS + peorDocumento) >= 20_000);
});
