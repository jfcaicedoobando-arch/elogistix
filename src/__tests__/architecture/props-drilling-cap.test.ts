/**
 * Guardrail de prop drilling (auditoría 2026-08-18, punto 7).
 *
 * Analogía: una caja con 25 cables sueltos es imposible de mantener; los
 * agrupamos en 3 mazos con etiqueta (`filtros`, `tabla`, `acciones`).
 *
 * Ningún `interface *Props*` de un componente puede pasar de MAX_PROPS
 * campos de primer nivel. Si necesitas más, agrupa en objetos con un tipo
 * exportado y nombre de dominio.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sync as globSync } from "fast-glob";

const MAX_PROPS = 18;

function contarCampos(cuerpo: string): number {
  return (cuerpo.match(/^ {2}["'\w]+\??:/gm) ?? []).length;
}

describe("prop drilling acotado", () => {
  it(`ninguna interface *Props* excede ${MAX_PROPS} campos`, () => {
    const archivos = globSync("src/**/*.tsx", { ignore: ["**/*.test.tsx"] });
    const excedidos: string[] = [];

    for (const archivo of archivos) {
      const contenido = readFileSync(archivo, "utf8");
      const bloques = contenido.matchAll(/interface \w*Props\w* \{([\s\S]*?)\n\}/g);
      for (const bloque of bloques) {
        const total = contarCampos(bloque[1]);
        if (total > MAX_PROPS) excedidos.push(`${archivo} (${total} props)`);
      }
    }

    expect(excedidos, `Agrupa props en objetos de dominio:\n${excedidos.join("\n")}`).toEqual([]);
  });
});
