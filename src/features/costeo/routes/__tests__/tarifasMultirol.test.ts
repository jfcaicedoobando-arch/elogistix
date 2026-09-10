/**
 * Regresión MR-UI-01 / MR-UI-02 (auditoría multirol 13.823.251).
 * Estáticas y mínimas: no renderizan la página (pesada), verifican el
 * contrato de las correcciones directamente sobre el código fuente.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const pagina = readFileSync(join(ROOT, "src/features/costeo/routes/CosteoTarifas.tsx"), "utf8");
const columnas = readFileSync(
  join(ROOT, "src/features/costeo/components/_sections/tarifasColumns.tsx"),
  "utf8",
);

describe("MR-UI-01: título del documento", () => {
  it("CosteoTarifas fija el título de la pestaña", () => {
    expect(pagina).toContain('useDocumentTitle("Tarifas marítimas")');
  });
});

describe("MR-UI-02: tabla usable en 1280x720", () => {
  it("Flete y Recargos se retiran bajo 2xl para liberar ancho en HD", () => {
    const matches = columnas.match(/hidden 2xl:table-cell/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(columnas).not.toContain("hidden xl:table-cell");
    expect(columnas).not.toContain("hidden lg:table-cell");
  });
  it("Acciones queda fija a la derecha cuando hay desbordamiento", () => {
    expect(columnas).toContain("stickyRight: true");
  });
});
