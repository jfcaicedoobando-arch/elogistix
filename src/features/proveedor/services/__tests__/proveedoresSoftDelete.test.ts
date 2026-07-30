/**
 * Regresión: los proveedores eliminados (soft-delete) no deben aparecer en
 * ningún catálogo ni selector. Bug reportado 2026-07-30.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ARCHIVOS = [
  "src/features/embarques/services/queries/proveedores.ts",
  "src/features/costeo/services/agentes.ts",
  "src/features/proveedor/services/duplicadoRfc.ts",
  "src/features/proveedor/services/proveedoresCrud.ts",
];

describe("catálogos de proveedores filtran soft-delete", () => {
  it.each(ARCHIVOS)("%s filtra deleted_at", (archivo) => {
    const src = readFileSync(archivo, "utf8");
    const lecturas = src
      .split('from("proveedores")')
      .slice(1)
      .map((bloque) => bloque.slice(0, 600))
      .filter((b) => b.includes(".select(") && !b.includes(".insert(") && !b.includes(".update("));
    expect(lecturas.length).toBeGreaterThan(0);
    for (const bloque of lecturas) {
      expect(bloque).toContain('.is("deleted_at", null)');
    }
  });
});
