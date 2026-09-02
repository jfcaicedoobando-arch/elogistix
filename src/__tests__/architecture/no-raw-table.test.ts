/**
 * Guardrail de arquitectura — `@/components/ui/table` (primitiva shadcn) sólo
 * puede importarse desde archivos de la allowlist. El resto debe usar
 * `<DataTable />` + `columnBuilders`/`defineColumns` para mantener un único
 * design language en toda la app.
 *
 * Este test es la RED DE RESPALDO del bloque `no-raw-table` en
 * `eslint.config.js`. Si alguien relaja la regla de ESLint sin actualizar la
 * allowlist, este test falla en CI.
 *
 * Cómo pedir excepción:
 *   1. Agregar el path relativo a `ALLOWLIST` (aquí abajo) con un comentario.
 *   2. Agregar el mismo path al bloque `no-raw-table` en `eslint.config.js`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");
const RAW_TABLE_IMPORT = /from\s+["']@\/components\/ui\/table["']/;

/** JSX de tabla cruda: `<table ...>` fuera de DataTable/DetailTable. */
const RAW_TABLE_JSX = /<\s*table[\s>]/;

/** Quita comentarios: un `<table>` citado en la documentación no es una tabla. */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * Deuda congelada (UX-03): archivos que hoy renderizan `<table>` crudo.
 * NO agregar entradas nuevas; quitar al migrar a DataTable/DetailTable.
 */
const RAW_TABLE_JSX_DEBT: readonly string[] = [
  // Única excepción permanente: la primitiva shadcn.
  "src/components/ui/table.tsx",
];


/** Archivos autorizados a importar `@/components/ui/table` directamente. */
const ALLOWLIST: readonly string[] = [
  // Implementación misma del DataTable — consume las primitivas.
  // Contrato visual de tablas de detalle (envuelve TableHead/TableRow/TableCell).
  "src/components/shared/DetailTable.tsx",
  "src/components/shared/dataTable/DataTableContent.tsx",
  "src/components/shared/dataTable/DataTableBody.tsx",
  "src/components/shared/dataTable/DataTableBodyEmpty.tsx",
  "src/components/shared/dataTable/DataTableBodySkeleton.tsx",
  "src/components/shared/dataTable/DataTableHeaderRow.tsx",
  "src/components/shared/dataTable/DataTableRow.tsx",
  // Form-tables editables con render row complejo (inputs/textareas por celda).
  "src/features/cotizacion/components/SeccionMercanciaAerea.tsx",
  "src/features/cotizacion/components/SeccionMercanciaMaritimaLCL.tsx",
  "src/features/cotizacion/components/TablaConceptosGenerico.tsx",
  "src/features/cotizacion/components/TablaCostosDetalle.tsx",
  // Sub-vistas read-only con render row complejo (extraídas de FacturaConceptosTable).
  "src/features/facturacion/components/detalle/FacturaConceptosRows.tsx",
  "src/features/portal/components/factura/PortalFacturaConceptosTable.tsx",
  "src/features/costeo/components/DemorasTarifaEditor.tsx",
  // Sub-tablas read-only estáticas (sin sort/paginación).
  "src/features/cotizacion/components/seccionMercancia/DimensionesLCLTable.tsx",
  "src/features/cotizacion/components/seccionMercancia/DimensionesAereasTable.tsx",
  "src/features/embarques/components/tabResumen/EmbarquesRelacionadosCard.tsx",
  "src/features/embarques/components/pnl/PnlProveedoresTable.tsx",
  "src/features/embarques/components/pnl/PnlComparativaTable.tsx",
  // Estado de cuenta: filas expandibles con sub-rows (pagos + notas), no soportado por DataTable.
  "src/features/facturacion/estadoCuenta/components/EstadoCuentaTable.tsx",
  // Sub-vistas extraídas de EstadoCuentaTable (límite 200 líneas).
  "src/features/facturacion/estadoCuenta/components/EstadoCuentaFilaFactura.tsx",
  "src/features/facturacion/estadoCuenta/components/EstadoCuentaGrupoMoneda.tsx",
  "src/features/facturacion/estadoCuenta/components/EstadoCuentaTableHead.tsx",
  // Renglón editable de conceptos extraídos por IA (inputs por celda).
  "src/features/cxp/components/CfdiConceptoIaRow.tsx",
  // Catálogos con toggles inline por fila.
  "src/features/configuracion/components/CatalogoClavesSATCard.tsx",
  "src/features/configuracion/components/CatalogoClavesSATCard.parts.tsx",
  // Detalle del pago: tabla read-only con colspans y pie de totales aplicados.
  "src/features/tesoreria/components/DetallePagoAplicaciones.tsx",
  // Tabla estática de 2 renglones (flujo por moneda) en dashboard de tesorería.
  "src/features/tesoreria/routes/_sections/TesoreriaFlujoMonedas.tsx",
  // Pagos programados: usa <DataTable /> y sólo compone el pie de totales
  // (TableRow/TableCell con colSpan) vía el slot `footer`.
  "src/features/tesoreria/routes/_sections/PagosProgramadosTablas.tsx",
  // Refacturación: comparativos estáticos read-only dentro del asistente.
  "src/features/facturacion/components/refacturacion/ComparativoConsistencia.tsx",
  "src/features/facturacion/components/refacturacion/RefacturacionPreviewSaldos.tsx",
  // CRM: editores con inputs por celda y tabla de higiene read-only compacta.
  "src/features/crm/components/MetasActividadEditor.tsx",
  "src/features/crm/components/PresupuestoCrmEditor.tsx",
  "src/features/crm/components/higiene/HigieneTabla.tsx",
  // Estado de resultados: subtotales con colSpan y fila de margen con fondo
  // propio — patrón no soportado por <DataTable />.
  "src/features/profit/components/EstadoResultadosTable.tsx",
  // Presupuesto: grid editable (inputs por celda) y comparativo con
  // encabezado ordenable + barra de cumplimiento por fila.
  "src/features/presupuesto/components/TabCaptura.tsx",
  "src/features/presupuesto/components/TabVsReal.tsx",
  // Sub-vistas de TabVsReal extraídas por el límite de 200 líneas.
  "src/features/presupuesto/components/VsRealCuerpo.tsx",
  "src/features/presupuesto/components/VsRealFila.tsx",
  // Flujo semanal de tesorería: filas expandibles con colSpan por semana.
  "src/features/tesoreria/components/TablaFlujoSemanal.tsx",
  // Ola 5.2 — migrados de `<table>` crudo a primitivas + DetailTable
  // (tablas de detalle read-only / sub-tablas sin sort ni paginación).
  "src/components/shared/LoteRenglonesTable.tsx",
  "src/features/admin/components/MigrarRolesLegacyPreviewTable.tsx",
  "src/features/admin/components/diagnosticoHealth/HealthSlowestTable.tsx",
  "src/features/admin/routes/AdminDemoLeads.tsx",
  "src/features/anticipos-proveedor/components/AnticiposAplicadosSection.tsx",
  "src/features/compras/routes/_sections/ConciliacionDetalleCuerpoTabla.tsx",
  "src/features/compras/routes/_sections/ConciliacionDetalleFilaRenglon.tsx",
  "src/features/cotizacion/components/plantillas/PlantillasTabla.tsx",
  "src/features/cotizacion/components/revalidacion/RevalidarTarifaModal.tsx",
  "src/features/cotizacion/routes/CotizacionInformativaDetalle.tsx",
  "src/features/crm/components/ImportarLeadsCsvPreview.tsx",
  "src/features/crm/components/OportunidadCotizacionesList.tsx",
  "src/features/crm/routes/Analitica.tsx",
  "src/features/crm/routes/CrmDashboard.tsx",
  "src/features/cxp/components/CfdiConceptosPreview.tsx",
  "src/features/cxp/components/ConceptosFacturaSection.tsx",
  "src/features/cxp/components/DialogDetallePagosProveedor.fila.tsx",
  "src/features/cxp/components/DialogDetallePagosProveedor.sections.tsx",
  "src/features/cxp/components/DialogPagoLoteRenglones.tsx",
  "src/features/cxp/components/NotaCreditoFila.tsx",
  "src/features/cxp/components/NotasCreditoSection.tsx",
  "src/features/dashboardEjecutivo/components/SaldosBancosCard.tsx",
  "src/features/embarques/components/OrigenCostosSection.tsx",
  "src/features/embarques/components/contenedores/SeccionContenedoresReadonly.tsx",
  "src/features/embarques/components/costos/GrupoCostosProveedor.tsx",
  "src/features/facturacion/components/CobroLoteRenglon.tsx",
  "src/features/facturacion/components/NotasCreditoRecientes.tsx",
  "src/features/facturacion/estadoCuenta/components/EstadoCuentaRowExpanded.tsx",
  "src/features/marketing/routes/GuiaPuertosMexicoArticle.tsx",
  "src/features/proformas/components/portal/PortalProformaResumen.tsx",
];

describe("architecture — no raw @/components/ui/table imports", () => {
  it("solo la allowlist puede importar @/components/ui/table", () => {
    const violations: string[] = [];
    for (const f of walk(join(ROOT, "src"), {
      excludeDirs: ["__tests__", "node_modules"],
      excludeFileRe: /\.(test|spec)\.tsx?$/,
    })) {
      const src = readFileSync(f, "utf8");
      if (!RAW_TABLE_IMPORT.test(src)) continue;
      const rel = relPath(ROOT, f);
      if (!ALLOWLIST.includes(rel)) violations.push(rel);
    }
    expect(
      violations,
      `Archivos que importan @/components/ui/table fuera de la allowlist.\n` +
        `Usa <DataTable /> + columnBuilders o agrégalos a ALLOWLIST en\n` +
        `src/__tests__/architecture/no-raw-table.test.ts y a eslint.config.js.\n\n` +
        violations.join("\n"),
    ).toEqual([]);
  });

  it("no hay entradas obsoletas en la allowlist de raw table", () => {
    const stale: string[] = [];
    for (const rel of ALLOWLIST) {
      try {
        const src = readFileSync(join(ROOT, rel), "utf8");
        if (!RAW_TABLE_IMPORT.test(src)) stale.push(rel);
      } catch {
        stale.push(`${rel} (no existe)`);
      }
    }
    expect(
      stale,
      `Entradas en ALLOWLIST que ya no importan @/components/ui/table (o no existen).\n` +
        `Elimínalas de ALLOWLIST y de eslint.config.js.\n\n` +
        stale.join("\n"),
    ).toEqual([]);
  });
  /**
   * Ola C · C.2 (R3-V-1) — Ratchet anti-crecimiento de la allowlist.
   * La allowlist creció +5 sin penalización; ahora tiene tope. Si migras un
   * archivo a DataTable y bajas la lista, BAJA también el tope.
   */
  it("la allowlist de ui/table no crece por encima del tope", () => {
    const TOPE = 70; // 69 actuales + 1 de holgura
    expect(
      ALLOWLIST.length,
      `La allowlist tiene ${ALLOWLIST.length} entradas (tope ${TOPE}).\n` +
        "Migra el archivo a <DataTable />/<DetailTable /> en vez de ampliar la excepción.",
    ).toBeLessThanOrEqual(TOPE);
  });

  it("si bajaste entradas de la allowlist, baja el tope", () => {
    const TOPE = 70;
    expect(
      ALLOWLIST.length,
      "Bajaste entradas de la allowlist: ajusta TOPE a la nueva cuenta + 1 de holgura.",
    ).toBeGreaterThan(TOPE - 6);
  });

  it("no hay JSX <table> crudo fuera de la deuda congelada", () => {
    const violations: string[] = [];
    for (const f of walk(join(ROOT, "src"), {
      excludeDirs: ["__tests__", "node_modules"],
      excludeFileRe: /\.(test|spec)\.tsx?$/,
    })) {
      // Sólo componentes: los generadores de HTML/PDF (.ts) no son JSX.
      if (!f.endsWith(".tsx")) continue;
      const src = readFileSync(f, "utf8");
      if (!RAW_TABLE_JSX.test(sinComentarios(src))) continue;
      const rel = relPath(ROOT, f);
      if (!RAW_TABLE_JSX_DEBT.includes(rel)) violations.push(rel);
    }
    expect(
      violations,
      `Nuevas tablas crudas detectadas. Usa <DataTable /> o <DetailTable />.\n\n` +
        violations.join("\n"),
    ).toEqual([]);
  });
});
