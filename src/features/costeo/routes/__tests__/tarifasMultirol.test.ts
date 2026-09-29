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
const filtros = readFileSync(
  join(ROOT, "src/features/costeo/components/CosteoTarifasFiltros.tsx"),
  "utf8",
);
const filaDataTable = readFileSync(
  join(ROOT, "src/components/shared/dataTable/DataTableRow.tsx"),
  "utf8",
);
const contenidoDataTable = readFileSync(
  join(ROOT, "src/components/shared/dataTable/DataTableContent.tsx"),
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
  it("el DataTable compartido comunica y hace accesible el desplazamiento horizontal", () => {
    expect(contenidoDataTable).toContain("Desplaza horizontalmente para consultar las demás columnas.");
    expect(contenidoDataTable).toContain('role="status"');
    expect(contenidoDataTable).toContain('role={overflowing ? "region" : undefined}');
    expect(contenidoDataTable).toContain('aria-label={overflowing ? "Tabla con desplazamiento horizontal" : undefined}');
    expect(contenidoDataTable).toContain("tabIndex={overflowing ? 0 : undefined}");
    expect(contenidoDataTable).toContain("focus-visible:ring-2");
  });
  it("usa fondos opacos en las celdas fijas para impedir texto superpuesto", () => {
    expect(filaDataTable.match(/bg-inherit/g)).toHaveLength(2);
    expect(filaDataTable).toContain("meta.sticky && STICKY_LEFT");
    expect(filaDataTable).toContain("meta.stickyRight && STICKY_RIGHT");
    expect(filaDataTable).not.toMatch(/STICKY_(?:LEFT|RIGHT)[\s\S]*?bg-(?:muted|primary)\/[0-9]+/);
  });
});
