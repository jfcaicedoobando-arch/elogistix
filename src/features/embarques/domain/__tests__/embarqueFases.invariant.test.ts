/**
 * Bloque 2.4 arquitectura · Fuente única DB↔TS para el orden canónico de
 * fases de un embarque.
 *
 * El orden lógico definido en `calcularFasesEmbarque` (`embarqueFases.ts`)
 * mapea cada fase a un estado del enum `estado_embarque` que vive en Postgres
 * y llega al front vía `src/integrations/supabase/types.ts` → `Constants`.
 *
 * Si alguien agrega/renombra un estado en la BD (por ejemplo cambia
 * "En Aduana" por "Aduana"), el enum se regenera pero el helper del front
 * podría quedar apuntando a un literal fantasma. Este test hace fallar CI
 * en ese momento — es la contraparte TS del snapshot SQL introducido en 2.2.
 */
import { describe, it, expect } from "vitest";
import { Constants } from "@/integrations/supabase/types";

/**
 * Estados del enum `estado_embarque` que el helper `calcularFasesEmbarque`
 * espera encontrar. Los estados "Borrador", "En Proceso", "Cotización" y
 * "Cancelado" viven en el enum pero no forman parte de la línea de tiempo
 * canónica (v13.303.22): pre-embarque o terminal negativo.
 */
const ESTADOS_CANONICOS_EMBARQUE = [
  "Confirmado",
  "En Tránsito",
  "Arribo",
  "En Aduana",
  "Entregado",
  "EIR",
  "Por liquidar",
  "Cerrado",
  // "Llegada" es un alias legacy de "Arribo" — sigue en el enum por
  // compatibilidad y el helper lo mapea a la misma fase.
  "Llegada",
] as const;

describe("embarqueFases · invariante DB↔TS (Bloque 2.4)", () => {
  it("cada estado usado por calcularFasesEmbarque existe en el enum estado_embarque de la BD", () => {
    const enumValues = new Set<string>(Constants.public.Enums.estado_embarque);
    const missing = ESTADOS_CANONICOS_EMBARQUE.filter((e) => !enumValues.has(e));
    expect(missing).toEqual([]);
  });
});
