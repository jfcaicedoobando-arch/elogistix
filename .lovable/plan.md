# Auditoría arquitectónica (post v8.69.0)

## Estado general

La arquitectura está en muy buen estado tras los refactors recientes:
- **Servicios**: 19 servicios + 3 directorios modulares (`embarque/`, `proforma/`, `portal/`, `cotizacion/`).
- **Hooks**: la mayoría son wrappers delgados de React Query sobre servicios.
- **Páginas**: todas por debajo de 250 líneas, actuando como contenedores presentacionales.
- **Dominio**: lógica financiera, de proforma, embarque y cotización centralizada en `src/lib/domain/` y `src/lib/parsers/`.
- **Tests**: 191/191 pasando.
- **Toast**: ya unificado en `useToast` (no quedan imports de `sonner`).
- **Componentes UI**: ningún componente fuera de `ui/` accede directo a Supabase (todo migrado).

## Hallazgos abiertos (priorizados)

### Críticos (deuda técnica activa)

**C1 — Hooks que aún hacen `supabase.rpc/from` directo (6 archivos)**
Quedan 6 hooks que conservan llamadas directas a Supabase, lo que rompe el patrón "hook = wrapper de servicio":
- `useConfiguracion.ts` — lectura/escritura de `public.configuracion`.
- `useConfiguracionGlobal.ts` — lectura/escritura global.
- `usePlanes.ts` — CRUD de planes.
- `useFacturas.ts` — listado de facturas.
- `useDashboardData.ts` — 2 RPC (`dashboard_summary`, `dashboard_details`).
- `useOperacionesData.ts` — 1 RPC (`operaciones_stats`).

**C2 — `useNuevoEmbarqueWizard.ts` (336 líneas)**
Es el hook más grande del repo. Mezcla estado del wizard + validación + hidratación desde cotización + manejo de expedientes + subida de documentos. Debería extraerse a:
- `lib/domain/embarqueWizard.ts` (validaciones puras + hidratación desde cotización).
- `useNuevoEmbarqueWizard.ts` queda como orquestador (<150 líneas).

### Medios (mejoras de cohesión)

**M1 — `TabProformas.tsx` (270 líneas) y `TabProformasPendientes.tsx` (246 líneas)**
Contienen filtrado, conteos, definiciones de columnas y paginación inline. Extraer:
- `useTabProformasController()` con `filtered`, `counts`, `paginated`, `columns`.
- Componente queda <120 líneas (solo JSX).

**M2 — `DialogGenerarProforma.tsx` (237 líneas)**
Ya no llama a Supabase directo, pero gestiona estado de wizard multi-paso (selección → confirmación). Extraer un `useDialogGenerarProformaController()`.

**M3 — Colores hardcodeados (15+ archivos)**
Persisten clases tipo `bg-blue-100 text-blue-800` para badges de estado en:
- `TabProformas.tsx`, `ProformaBadge.tsx`, `embarqueColumns.tsx`, `BloqueVinculacion.tsx`, `HistorialProformas.tsx`, `ResumenConceptosVenta.tsx`, `KpiCard.tsx`, `OperacionesWidgets.tsx`, `ClienteSummaryCards.tsx`, `ReportesKpiCards.tsx`, `ReportesTablaClientes.tsx`, `cotizacion/CotizacionWizardLayout.tsx`, `pages/Operaciones.tsx`, `admin/AdminOrganizaciones.tsx`, etc.

Solución: tokens semánticos en `index.css` + `tailwind.config.ts` (`success`, `warning`, `info`, `pending`) y un `<StatusBadge variant="..."/>` reutilizable.

**M4 — `src/data/changelog/legacy.ts` (1523 líneas) y `changelogData.ts` (694 líneas)**
El changelog crece sin techo. Recomendado: dividir por año (`changelog/2024.ts`, `changelog/2025.ts`, `changelog/2026.ts`) y mantener solo las últimas N entradas en el bundle inicial (lazy-load del histórico).

### Opcionales (cosmético / organización)

**O1 — Reorganización de `src/lib/`**
11 archivos sueltos en la raíz. Agruparlos en subcarpetas semánticas:
```text
src/lib/
  formatters/   ← formatters.ts
  financial/    ← financialUtils.ts, profitUtils.ts, costosUSD.ts
  storage/      ← storageUtils.ts
  ui/           ← uiMappings.ts, estadoConfig.ts
  errors/       ← errorUtils.ts
  contacto/     ← contactoUtils.ts
  query/        ← queryKeys.ts
  domain/, mappers/, parsers/  ← (ya existen)
  utils.ts      ← (cn helper, queda en raíz)
```

**O2 — Componentes UI shadcn no usados**
`carousel.tsx` (224 líneas), `menubar.tsx` (207 líneas), `chart.tsx` (303 líneas), `context-menu.tsx` (178 líneas) — verificar uso real y borrar los no consumidos para reducir bundle.

**O3 — `usuarioService.ts` Edge Functions**
La gestión de usuarios va por Edge Functions; documentar este contrato en un README dentro de `src/services/` para mantener consistencia con el resto que va por RPC/PostgREST.

## Plan de acción ordenado

| # | Versión | Acción | Riesgo | Impacto |
|---|---------|--------|--------|---------|
| 1 | v8.70.0 | **C1**: Migrar 6 hooks restantes a servicios (`configuracionService`, `planesService`, `facturasService`, `dashboardService`, `operacionesService`). Eliminar imports directos a `supabase`. | Bajo | Alto |
| 2 | v8.71.0 | **C2**: Extraer dominio de `useNuevoEmbarqueWizard` a `lib/domain/embarqueWizard.ts`. Tests unitarios para validación e hidratación. | Medio | Alto |
| 3 | v8.72.0 | **M1**: Controller hooks para `TabProformas` y `TabProformasPendientes`. | Bajo | Medio |
| 4 | v8.73.0 | **M2**: Controller hook para `DialogGenerarProforma`. | Bajo | Medio |
| 5 | v8.74.0 | **M3**: Sistema de tokens semánticos + `<StatusBadge>` y migración masiva de colores hardcodeados. | Medio (visual) | Alto (consistencia) |
| 6 | v8.75.0 | **M4**: Particionar `changelog/` por año + lazy-load histórico. | Bajo | Medio (bundle) |
| 7 | v8.76.0 | **O1**: Reorganizar `src/lib/` en subcarpetas semánticas. | Bajo (muchos imports) | Bajo |
| 8 | v8.77.0 | **O2**: Auditoría y limpieza de componentes shadcn no usados. | Muy bajo | Bajo (bundle) |

## Detalles técnicos por paso

**Paso 1 (C1)** — Servicios nuevos a crear:
- `configuracionService.ts` ya existe → mover lógica de `useConfiguracion.ts` y `useConfiguracionGlobal.ts` allí.
- Crear `planesService.ts`, `facturasService.ts`, `dashboardService.ts`, `operacionesService.ts`.
- Hooks quedan como `useQuery({ queryFn: () => fetchX() })`.

**Paso 2 (C2)** — Funciones puras a extraer:
- `validateStepDatosGenerales(form): EmbarqueValidationErrors`
- `hydrateFromCotizacion(cotizacion, costos): Partial<EmbarqueForm>`
- `resolverModoExpediente(clientes, clienteId): ModoExpediente`

**Paso 5 (M3)** — Tokens propuestos en `index.css`:
```css
--status-success: 142 71% 45%;
--status-warning: 38 92% 50%;
--status-info: 217 91% 60%;
--status-pending: 220 14% 75%;
--status-danger: 0 84% 60%;
```

## Próximo paso

Ejecutar **Paso 1 (v8.70.0)** — migración de los 6 hooks restantes a servicios. Es el cambio de mayor impacto, menor riesgo y deja el patrón "hook = wrapper" 100% consistente en todo el repo.
