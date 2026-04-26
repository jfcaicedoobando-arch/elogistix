# Auditoría arquitectónica — Estado actual

Tras los refactors recientes (eliminación de shims, extracción de controllers, catálogo de errores, ValidationAlert reubicado) la arquitectura está **mayoritariamente limpia**:

- ✅ `services/` bien segmentado por dominio
- ✅ `hooks/` agrupados por feature
- ✅ Páginas delgadas (la más grande tiene 227 líneas)
- ✅ Sin shims/re-exports redundantes
- ✅ Catálogo de errores y feedback centralizados disponibles

## Hallazgos restantes (5 mejoras)

### 1. CRÍTICO — Toasts inline sin migrar (49 archivos)
`appFeedback.ts` existe pero solo lo usan 4 archivos. Los 49 restantes siguen llamando `toast({ title, description, variant })` directamente, lo que rompe la consistencia de severidad (warning/error/success) y dificulta cambios futuros (ej. internacionalización, telemetría).

Top ofensores: `useProformas.ts` (10), `useCotizacionWizardSteps.ts` (9), `useCotizacionDetalleHandlers.ts` (7), `useClienteDetalleController.ts` (7), `useEmbarqueDocumentosActions.ts` (5), `useNuevoClienteController.ts` (5), catálogos (5 c/u).

### 2. MEDIO — Componentes sueltos en raíz de `src/components/`
19 archivos `.tsx` viven directamente en `src/components/` mezclando layout, navegación, utilitarios y selectores. Mover a subcarpetas semánticas:
- `layout/`: `AppSidebar`, `Layout`, `NavLink`, `OrgSwitcher`, `ThemeToggle`, `RouteLoadingFallback`
- `auth/`: `ProtectedRoute`, `PortalProtectedRoute`
- `selects/`: `NavieraSelect`, `PortSelect`, `SearchInput`
- `shared/`: `DataTable`, `PaginationControls`, `DocumentChecklist`, `DoubleConfirmDeleteDialog`, `ErrorBoundary`, `BitacoraActividad`, `GlobalSearch`

### 3. MEDIO — Hooks sueltos en raíz de `src/hooks/`
24 hooks `.ts` en raíz que pertenecen a features ya existentes:
- → `admin/`: `useAdminData`, `useAdminOrgDetalle`, `useOrganizationsList`, `useOrgMembersMutations`, `usePlanes`
- → `cliente/`: `useClienteFinancials`, `useClientUsersMutations`, `useRentabilidadClientes`
- → `embarque/`: `useEmbarques`, `useTrackingLinks`, `useProfitMaps`
- → `cotizacion/`: `useCotizaciones`, `useConceptosForm`
- → `operaciones/`: `useOperacionesData`, `useDesempenoChartData`
- → `usuario/`: `useUsuarios`, `useUsuarioMutations`
- → `shared/`: `useDebounce`, `useListPageState`, `useOrgFilter`, `usePermissions`, `useSidebarAlerts`, `useBitacora`, `useGlobalSearch`

### 4. BAJO — Hook gigante `useNuevoEmbarqueWizard.ts` (260 líneas)
Único hook por encima del umbral cómodo (200 líneas). Contiene paso-a-paso, validación, persistencia parcial y submit. Se puede dividir en `useNuevoEmbarqueWizardSteps` + `useNuevoEmbarqueWizardSubmit`.

### 5. BAJO — `ProfitBadge.tsx` resucitado en raíz
Se eliminó en el refactor anterior y volvió a aparecer en `src/components/ProfitBadge.tsx` (1.5 KB). Verificar si es duplicado o si reemplaza a uno en `dashboard/`.

---

## Plan de ejecución (1 paso)

Las mejoras **#2, #3 y #5** son refactors de movimiento de archivos con **alto riesgo de romper imports en cascada** (sin cambios funcionales pero ~150 imports a actualizar). La **#4** requiere análisis cuidadoso del wizard. La **#1** aporta el mayor beneficio arquitectónico real.

**Propuesta**: ejecutar en este turno **solo la mejora #1** (la más impactante y autocontenida), más una verificación de la #5:

1. **Migrar los 49 archivos** de `toast({...})` inline a `notifyError`/`notifyWarning`/`notifySuccess`/`notifyInfo` desde `@/lib/ui/appFeedback`. Mapeo:
   - `variant: "destructive"` → `notifyError`
   - títulos con "Atención"/"Advertencia" → `notifyWarning`
   - resto sin variant → `notifySuccess` o `notifyInfo` según contenido
2. **Verificar `ProfitBadge.tsx`**: si es duplicado del de `dashboard/`, eliminarlo y reapuntar imports; si no, moverlo a `components/shared/`.
3. **Ejecutar** `bunx tsc --noEmit` y suite de tests para validar.
4. **Añadir entrada de changelog** v8.96.0 documentando la unificación de feedback.

Las mejoras #2, #3 y #4 quedan como propuestas para iteraciones siguientes (movimientos masivos de archivos merecen su propio turno aislado para revisión).

## Detalles técnicos

- `appFeedback` ya expone: `notifyError`, `notifyWarning`, `notifySuccess`, `notifyInfo` con tonos consistentes con `kpiTones`.
- No hay cambios de comportamiento visible al usuario más allá de severidad correcta en tonos de los toasts.
- Sin migraciones de base de datos.
- Sin nuevos paquetes.
