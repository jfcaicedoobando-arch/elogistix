## Estado del plan

**Respuesta corta: NO al 100%.** Faltan **2 migraciones reales** que aplican la regla del plan y hay **2 issues bloqueantes de CI** que introdujimos y aún no arreglamos.

### Lo que ya se hizo (Fases 1 → 4)

- ✅ **Fase 1** — Infra: `getRowHref` en `DataTable`/`DataTableBody`/`ResponsiveDataTable`, helper `useDrilldownRow`, wrapper `DrilldownRow`, detección de controles internos vía `data-no-row-nav`, tests de `getRowHref` en regresión.
- ✅ **Fase 2** — Barrido por módulos: ERP (ventas, operaciones, cobranza, compras, catálogos, CRM, costeo, detalle embarque, sub-tablas), auditoría, admin (organizaciones, planes, diagnóstico), reportes, portal cliente/agente, migrados a `getRowHref` / `onRowClick`.
- ✅ **Fase 2.1** (extra) — Cards / list-items de dashboards (CRM, finanzas, operaciones) migrados a `DrilldownRow`.
- ✅ **Fase 3** — `src/__tests__/architecture/tables-no-inline-links.test.ts` creado.
- ✅ **Fase 4** — `APP_VERSION` en `13.203.0`, `CHANGELOG.md` actualizado, `mem://technical/ui-table-standardization` con la regla.

### Lo que falta

**A. Migraciones pendientes (2 archivos, dentro del scope original):**

1. `src/features/admin/routes/admin-org/PortalUsuariosTab.tsx:53` — Renderiza `<Link to={fichaPath}>` **dentro de una celda** del `DataTable` de usuarios del portal. Es exactamente el patrón que el plan pidió eliminar. **Fix:** quitar el `<Link>`, pasar `getRowHref={(row) => fichaPathFor(row)}` al `DataTable` y dejar la celda como texto plano.
2. `src/features/portal/components/dashboard/PortalFacturacionPendienteCard.tsx:41` — Card del dashboard del portal envuelve el bloque de datos con `<Link to="/portal/facturas">`. **Fix:** reemplazar por `<DrilldownRow href="/portal/facturas" ariaLabel="Ver facturas pendientes">` (mismo patrón que ya aplicamos a las otras cards del portal).

**B. Fuera de scope — se dejan como están:**

- `ComprasDashboardTiles.tsx` (`QuickLink`) — es un **tile de navegación** de dashboard tipo botón grande (equivalente a `KpiTile`), no una fila ni card con datos. `<Link>` legítimo.
- `CierreCheckItem.tsx` — es un item de checklist con `target="_blank"` a un recurso externo (documento). Se comporta como enlace explícito, no como fila de tabla.
- Marketing, headers, breadcrumbs, KPI tiles, footers, menús de usuario, banners — nunca estuvieron en scope.

**C. CI está rojo por 2 errores que introdujimos y no arreglamos:**

Del log `logs_77877421890.zip`:

1. **`audit:tests` — `duplicate-title`**: `src/__tests__/architecture/tables-no-inline-links.test.ts:56` tiene el mismo título `"no hay entradas obsoletas en la allowlist"` que `no-raw-table.test.ts:69`. **Fix:** renombrar a `"allowlist de tables-no-inline-links no tiene entradas obsoletas"` (o registrar en `DUPLICATE_ALLOWLIST` de `scripts/lib/tests.ts` si prefieres).
2. **`DataTable.e2e.test.tsx` — `useNavigate() may be used only in the context of a <Router>`**: al añadir `getRowHref` (Fase 1), envolvimos `.regression.test.tsx` y `.virtual.test.tsx` en `<MemoryRouter>` pero olvidamos `DataTable.e2e.test.tsx`. Falla 25+ tests del shard 20/20. **Fix:** shadow del `render` con wrapper `<MemoryRouter>` (idéntico al patrón de `DataTable.regression.test.tsx:13`).

### Propuesta de cierre

Un solo bloque de trabajo, 4 archivos:

```text
1. PortalUsuariosTab.tsx           → quitar <Link>, usar getRowHref
2. PortalFacturacionPendienteCard  → <Link> → <DrilldownRow>
3. tables-no-inline-links.test.ts  → renombrar título duplicado
4. DataTable.e2e.test.tsx          → envolver render() en <MemoryRouter>
```

Después: bump `APP_VERSION` a `13.203.1` y entrada `CHANGELOG.md` breve ("cierra Fase 2 pendientes + fix CI").

### Verificación

- `bun run audit:tests` → 0 violaciones.
- `bunx vitest run src/components/shared/dataTable/__tests__/DataTable.e2e.test.tsx src/__tests__/architecture/tables-no-inline-links.test.ts` → verde.
- `rg -n '<Link' src/features/admin/routes/admin-org/PortalUsuariosTab.tsx src/features/portal/components/dashboard/PortalFacturacionPendienteCard.tsx` → 0 resultados.

### Fuera de alcance

No se toca lógica, columnas, permisos ni datos. No se migran los tiles de navegación ni los items de checklist con `target="_blank"`.
