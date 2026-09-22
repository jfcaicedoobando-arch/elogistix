/**
 * Etapa 3 — selección de puerto en el bloque de Ruta.
 *
 * El texto visible (`origen`/`destino`) sigue siendo lo que lee el cliente; el
 * ID (`puertoOrigenId`/`puertoDestinoId`) es la identidad exacta del catálogo y
 * la fuente de verdad para buscar tarifa y heredar la ruta al embarque.
 *
 * Si el usuario cambia manualmente el puerto y ya había una tarifa vinculada,
 * esa tarifa deja de corresponder a la ruta: se desvincula junto con lo que
 * heredó (overrides, agente, naviera). Los conceptos y costos capturados NO se
 * tocan: el usuario decide qué hacer con ellos.
 */
import { OPTS, type Ctx } from "./overrideHelpers";

export type CampoPuerto = "origen" | "destino";

const CAMPO_ID = {
  origen: "puertoOrigenId",
  destino: "puertoDestinoId",
} as const;

export interface ResultadoSeleccionPuerto {
  /** `true` cuando la tarifa vinculada dejó de corresponder y se desvinculó. */
  tarifaDesvinculada: boolean;
}

export function aplicarSeleccionPuerto(
  ctx: Ctx,
  campo: CampoPuerto,
  valor: string,
  puertoId: string | null,
): ResultadoSeleccionPuerto {
  const campoId = CAMPO_ID[campo];
  const idPrevio = ctx.getValues(campoId) ?? null;
  const tarifaId = ctx.getValues("tarifaId");

  ctx.setValue(campo, valor, OPTS);
  ctx.setValue(campoId, puertoId, OPTS);

  if (!tarifaId || idPrevio === puertoId) return { tarifaDesvinculada: false };

  ctx.setValue("tarifaId", null, OPTS);
  ctx.setValue("tarifaOverride", {}, OPTS);
  ctx.setValue("agenteId", null, OPTS);
  ctx.setValue("agenteNombre", "", OPTS);
  ctx.setValue("navieraId", null, OPTS);
  ctx.setValue("navieraNombre", "", OPTS);
  return { tarifaDesvinculada: true };
}

export const MSG_TARIFA_DESVINCULADA =
  "Cambiaste la ruta, así que la tarifa vinculada ya no aplica. Elige una tarifa para la nueva ruta; los costos que ya capturaste se conservan.";
