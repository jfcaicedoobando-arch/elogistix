/**
 * Guardrail (Ola 20 · paso 4): los barriles de feature son SÓLO superficie
 * pública — nada de lógica dentro.
 *
 * Antes `catalogos/services/index.ts` tenía 159 líneas con 13 llamadas a la
 * base de datos: quien sólo quería el tipo `Naviera` se llevaba de paquete el
 * cliente de red. Es como un índice de libro con capítulos escritos dentro.
 *
 * Alcance: los barriles de nivel feature (`index.ts` directo bajo el feature o
 * bajo `services/` `types/` `hooks/` `domain/` `components/`). Los `index.ts`
 * de una subcarpeta-módulo (p. ej. `services/tracking/index.ts`) SÍ pueden
 * tener lógica: ahí el índice *es* el módulo.
 */
import { readFileSync } from "node:fs";
import fg from "fast-glob";
import { describe, expect, it } from "vitest";

const PATRON_BARRIL = "src/features/*/{,services/,types/,hooks/,domain/,components/}index.ts";

/** Acceso a datos: ningún barril debe tocar la base de datos. */
const ACCESO_DATOS = /\bsupabase\s*\.\s*(from|rpc|auth|functions|channel|storage)\b/;

/** Declaración de comportamiento (no cuenta re-exportar ni declarar tipos). */
const DECLARA_LOGICA =
  /^\s*(export\s+)?(async\s+)?function\s|^\s*export\s+const\s+[A-Za-z_$][\w$]*\s*(:[^=]+)?=\s*(async\s*)?\(|^\s*export\s+default\s/;

describe("barriles de feature sin lógica", () => {
  it("ningún barril de feature accede a la base de datos", async () => {
    const barriles = await fg(PATRON_BARRIL);
    const ofensores = barriles.filter((f) => ACCESO_DATOS.test(readFileSync(f, "utf8")));
    expect(ofensores).toEqual([]);
  });

  it("ningún barril de feature declara funciones (sólo re-exporta y declara tipos)", async () => {
    const barriles = await fg(PATRON_BARRIL);
    const ofensores: string[] = [];
    for (const archivo of barriles) {
      const lineas = readFileSync(archivo, "utf8").split("\n");
      lineas.forEach((linea, i) => {
        if (DECLARA_LOGICA.test(linea)) ofensores.push(`${archivo}:${i + 1}`);
      });
    }
    expect(ofensores).toEqual([]);
  });
});
