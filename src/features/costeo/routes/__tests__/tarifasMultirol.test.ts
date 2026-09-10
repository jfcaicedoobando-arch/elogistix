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
const tabla = readFileSync(
  join(ROOT, "src/features/costeo/components/CosteoTarifasTable.tsx"),
  "utf8",
);
const filtros = readFileSync(
  join(ROOT, "src/features/costeo/components/CosteoTarifasFiltros.tsx"),
  "utf8",
);
const filaDataTable = readFileSync(
  join(ROOT, "src/components/shared/dataTable/DataTableRow.tsx"),
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
    expect(matches.length).toBeGreaterThanOrEqual(3);
    expect(columnas).not.toContain("hidden xl:table-cell");
    expect(columnas).not.toContain("hidden lg:table-cell");
  });
  it("integra el contenedor bajo Ruta en HD y unifica filtros con el selector de vista", () => {
    expect(columnas).toContain('text-muted-foreground 2xl:hidden');
    expect(filtros).toContain('aria-label="Modo de vista"');
    expect(filtros).toContain('{total} {total === 1 ? "tarifa" : "tarifas"}');
  });
  it("sólo Acciones queda fija para no cubrir Estado ni columnas anteriores", () => {
    expect(columnas).toContain("stickyRight: true");
    expect(columnas).toContain('meta: { width: COL_W.estado },');
    expect(columnas).not.toContain('className: "sticky right-40');
    expect(columnas).not.toContain('headerClassName: "sticky right-40');
  });
  it("muestra un affordance visible para el desplazamiento horizontal en HD", () => {
    expect(tabla).toContain("Desplaza horizontalmente para consultar columnas secundarias");
    expect(tabla).toContain("2xl:hidden");
  });
  it("usa fondos opacos en las celdas fijas para impedir texto superpuesto", () => {
    expect(filaDataTable).toContain("[tr:nth-child(even)_&]:bg-muted");
    expect(filaDataTable).toContain("[tr:hover_&]:bg-muted");
    expect(filaDataTable).not.toMatch(/STICKY_(?:LEFT|RIGHT)[\s\S]*?bg-(?:muted|primary)\/[0-9]+/);
  });
});
