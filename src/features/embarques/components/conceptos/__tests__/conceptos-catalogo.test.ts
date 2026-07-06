/**
 * Invariante arquitectónica: los renglones de conceptos en el wizard de
 * embarques (FilaCostoPrecio, FilaVentaPrecio) NO deben usar la constante
 * hardcoded `CATALOGO_CONCEPTOS`. Los conceptos sólo provienen del
 * Catálogo de productos y servicios (`catalogo_claves_sat`) vía
 * `ConceptoCatalogoSelect` / `ProductoServicioSelect`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function leer(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("Embarques — conceptos vienen del Catálogo de productos y servicios", () => {
  it("FilaCostoPrecio no importa CATALOGO_CONCEPTOS", () => {
    const src = leer("src/features/embarques/components/conceptos/FilaCostoPrecio.tsx");
    expect(src).not.toMatch(/CATALOGO_CONCEPTOS/);
    expect(src).toMatch(/ConceptoCatalogoSelect/);
  });

  it("FilaVentaPrecio no importa CATALOGO_CONCEPTOS", () => {
    const src = leer("src/features/embarques/components/conceptos/FilaVentaPrecio.tsx");
    expect(src).not.toMatch(/CATALOGO_CONCEPTOS/);
    expect(src).toMatch(/ConceptoCatalogoSelect/);
  });

  it("ConceptoCatalogoSelect reutiliza ProductoServicioSelect (catálogo maestro)", () => {
    const src = leer("src/features/embarques/components/conceptos/ConceptoCatalogoSelect.tsx");
    expect(src).toMatch(/ProductoServicioSelect/);
  });
});
