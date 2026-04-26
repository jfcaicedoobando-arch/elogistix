## Auditoría arquitectónica (post v8.90.0) — Top 5 mejoras en un solo paso

### Hallazgos clave

1. **Quedan 14 servicios standalone** sin folder/barrel: `bitacoraService`, `catalogosService`, `clienteFinancialsService`, `clientUserService`, `configuracionService`, `dashboardService`, `facturasService`, `operacionesService`, `planesService`, `proveedorServices`, `reportesService`, `searchService`, `trackingService`, `usuarioService`.
2. **Páginas densas sin controller**: `Cotizaciones.tsx` (245 LOC, 7+ hooks + handlers inline) y `Facturacion.tsx` (234 LOC) mezclan estado, mutaciones, formato y JSX.
3. **`NuevoProveedorDialog.tsx`** (202 LOC) y **`EditarProveedorDialog.tsx`** (161 LOC) repiten el patrón densos del antiguo `NuevoClienteDialog`: estado + validación + mutación + UI mezclados.
4. **`CotizacionWizardLayout.tsx`** (222 LOC, el componente más grande de `components/`) probablemente acumula orquestación de pasos + render del shell.
5. **`src/components/shared/`** sigue con un único archivo (`ProfitBadge.tsx`); carpeta innecesaria.

---

### Top 5 mejoras (v8.91.0, ejecutables en un solo paso)

1. **Extraer controller de `NuevoProveedorDialog`** → `src/hooks/proveedor/useNuevoProveedorController.ts`
   - Mover estado, validación y mutación de creación al hook.
   - Componente queda presentacional (~80–100 LOC).

2. **Extraer controller de `EditarProveedorDialog`** → `src/hooks/proveedor/useEditarProveedorController.ts`
   - Mismo patrón: hook con estado/handlers, componente solo render.

3. **Extraer controller de `Cotizaciones.tsx`** → `src/hooks/cotizacion/useCotizacionesPageController.ts`
   - Mover `useListPageState`, `useCotizaciones`, `useDeleteCotizacion`, `useDuplicarCotizacion`, `useClientesForSelect`, filtros derivados (memo), KPIs y handlers (`handleDelete`, `handleDuplicar`, `handleExport`, `onRowClick`).
   - Página queda como composición de columnas + JSX (~120 LOC).

4. **Estandarizar 3 servicios críticos** a folder/barrel: `dashboardService`, `facturasService`, `searchService`
   - Crear `services/dashboard/index.ts`, `services/facturas/index.ts`, `services/search/index.ts` con el contenido actual.
   - Archivos antiguos quedan como shim de re-export (sin breaking changes).

5. **Promover `ProfitBadge` a `src/components/`** y eliminar `src/components/shared/`
   - Mover `shared/ProfitBadge.tsx` → `components/ProfitBadge.tsx`.
   - Dejar `shared/ProfitBadge.tsx` como shim de re-export (preserva imports actuales) y borrar la carpeta solo si queda vacía tras el shim; alternativamente dejar el shim un ciclo y borrar la carpeta en v8.92.0.

---

### Detalles técnicos

- **Sin breaking changes**: shims de re-export en archivos/rutas originales.
- **Verificación**: `bunx tsc -p tsconfig.app.json --noEmit` + `bunx vitest run` (184 tests deben seguir pasando).
- **Documentación**: actualizar `ARCHITECTURE.md` (formalizar patrón "Dialog presentacional + controller en hooks/<dominio>/") y agregar entrada **v8.91.0** a `src/content/changelogData.ts`.

### Fuera de alcance (futuras iteraciones)

- Migrar los 11 services standalone restantes a folder/barrel.
- Controller para `Facturacion.tsx` y `CotizacionDetalle.tsx`.
- Refactor de `CotizacionWizardLayout.tsx` (>200 LOC) en sub-componentes.
- Aplicar patrón controller a `Embarques.tsx` (requiere análisis más profundo: ya tiene `useEmbarquesPageState` específico).
