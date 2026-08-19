/**
 * Guardrail (Ola 19 · paso 1): "días entre dos fechas" se calcula en UN solo
 * lugar (`src/lib/date/dateOnly.ts`).
 *
 * Antes cada pantalla dividía la resta de milisegundos entre 86_400_000 con un
 * redondeo distinto (`floor`/`round`/`ceil`), así que la misma factura mostraba
 * 30 o 31 días vencidos según dónde se viera y el cambio de horario movía el
 * resultado un día. Eso se le cobra al cliente (demoras), por eso es crítico.
 *
 * Sigue permitido *sumar/restar* días (`Date.now() - 7 * 86_400_000`): lo que
 * se prohíbe es DIVIDIR entre un día en milisegundos para contar días.
 */
import { readFileSync } from "node:fs";
import fg from "fast-glob";
import { describe, expect, it } from "vitest";

/** Divisiones entre "un día en ms", en cualquiera de sus escrituras. */
const DIVISION_POR_DIA =
  /\/\s*\(?\s*(86_?400_?000|24\s*\*\s*60\s*\*\s*60\s*\*\s*1000|1000\s*\*\s*60\s*\*\s*60\s*\*\s*24|MS_POR_DIA|DAY_MS|DIA_MS|MS_DIA)\s*\)?/;

/**
 * Excepciones justificadas (no son "días vencidos" de negocio):
 * - `dateOnly.ts`: es la implementación central.
 * - `flujoProyectado.ts`: calcula el NÚMERO DE SEMANA ISO, no días.
 * - `bbva.parsers.ts`: convierte el serial de fecha de Excel.
 * - `expediente.ts` / `rutaEstado.ts`: anclan el "hoy" a CDMX (`hoyMx`) a
 *   propósito, porque la vigencia documental es fiscal, no local del navegador.
 * - `relativo.ts`: texto humano ("hace 3 días") por tiempo transcurrido, no por
 *   días de calendario.
 */
const EXCEPCIONES = [
  "src/lib/date/dateOnly.ts",
  "src/features/tesoreria/domain/flujoProyectado.ts",
  "src/features/tesoreria/domain/import/bbva.parsers.ts",
  "src/features/expediente/domain/expediente.ts",
  "src/features/costeo/utils/rutaEstado.ts",
  "src/lib/date/relativo.ts",
];

describe("un solo cálculo de días naturales", () => {
  it("ningún archivo productivo divide entre un día en milisegundos", async () => {
    const archivos = await fg(["src/**/*.ts", "src/**/*.tsx"], {
      ignore: ["src/**/__tests__/**", "src/**/*.test.ts", "src/**/*.test.tsx", ...EXCEPCIONES],
    });
    const ofensores: string[] = [];
    for (const archivo of archivos) {
      const lineas = readFileSync(archivo, "utf8").split("\n");
      lineas.forEach((linea, i) => {
        if (linea.trimStart().startsWith("*") || linea.trimStart().startsWith("//")) return;
        if (DIVISION_POR_DIA.test(linea)) ofensores.push(`${archivo}:${i + 1}`);
      });
    }
    expect(ofensores).toEqual([]);
  });
});
