# 🏗️ Auditoría Arquitectónica Consolidada

> Resultado de 5 subagentes paralelos: tamaño/estructura, separación de concerns, duplicación/dead code, complejidad/best practices y cohesión de features.
> **No se modifica código** — sólo se reporta y se propone orden de ataque.

---

## 🎯 Estado General

| Dimensión | Estado |
|---|---|
| ESLint warnings/errores activos | ✅ 0 |
| Archivos productivos > 200 líneas | ✅ 0 (límite Power-of-10 respetado) |
| Imports directos a `@/integrations/supabase/client` desde pages/components/hooks | ✅ 0 |
| Supabase channels sin cleanup | ✅ 0 |
| Casts `as Type` en servicios sin `SAFE-CAST` ni centralización | 🔴 21 |
| `useEffect` con `setTimeout` sin `clearTimeout` | 🟠 7 |
| Inline styles `style={{...}}` fuera de PDF | 🟡 6 archivos |
| Ciclos cross-feature | 🔴 4 (`admin↔configuracion`, `facturacion↔facturas`, `cotizacion↔embarques`, `proformas↔embarques`, `cliente↔reportes`) |
| Edge functions sin tests | 🔴 20/20 |
| Componentes "God" (fetch + dominio + UI) | 🟠 ~15 |

La base es sólida: límite de líneas, capa Supabase y ESLint están limpios. La deuda es de **organización (ciclos / split de features)**, **fugas de dominio en UI (bandejas + páginas)** y **tipado defensivo en servicios (casts)**.

---

## 📋 Hallazgos clave por bloque

### A. Arquitectura por features
- **`facturacion` ↔ `facturas`** (20 refs): mismo dominio partido en dos. `facturacion` no tiene `services/` y consume todo de `facturas`.
- **`admin` ↔ `configuracion`** (8 + 1): import bidireccional de componentes internos (TabNavieras, TabPuertos) y `exportOrganizationZip`.
- **`misc`**: cajón de sastre, sólo `queryKeys.ts`.
- **`proformas` ↔ `embarques`** (11 + 1) y **`cotizacion` ↔ `embarques`** (19 + 1): acoplamiento bidireccional a evaluar como subfeature.
- **`dashboardEjecutivo`** importa internals de `tesoreria` y `presupuesto` saltándose el barrel público.
- Servicios globales que pertenecen a features: `src/services/pagos-factura/`, `src/services/storage/facturas.ts`, `src/services/organization/`, `src/services/planes/`, `src/services/csf/`, `src/hooks/usuario/`.
- 18/26 features sin `types/`, 21/26 sin `domain/`, 20/26 con `queryKeys.ts` suelto en la raíz.

### B. Separación de concerns (UI ↔ dominio ↔ data)
- **`src/pages/auth/Unsubscribe.tsx`**: usa `fetch()` raw + `VITE_SUPABASE_URL/ANON` crudas dentro del componente.
- **`src/pages/auth/TrackingPublico.tsx`**, **`PdfPreviewCotizacion.tsx`**: `useQuery` directos sin hook envolvente.
- **Reglas de negocio embebidas en JSX de bandejas**: "atrasada > 7 días" (`FacturacionPorEmitir:11`), "vencida `dias_para_vencer < 0`" (`CxpPorPagar:11`), agregaciones financieras en `Cartera.tsx`, `CxpPorCapturar.tsx`, `SaldosBancosCard.tsx`.
- **Formateadores/cálculos de dominio en componentes**: `maskClabe` en `ProveedorDatosBancariosCard`, `transporteLabel` en `TrackingPublico`, `statusCounts` con `calcularEstadoEmbarque` dentro del render en `PortalEmbarques`.
- **Loops de bulk-insert dentro del JSX**: `Clientes.tsx:108`, `ProveedoresImportDialog.tsx:38`.
- **Páginas con >15 imports internos** (orquestadores de 7 capas): `Clientes.tsx` (25), `Cxp.tsx` (20), `CotizacionDetalle.tsx` (20), `FacturaDetalle.tsx` (20), `Cotizaciones.tsx` (18).

### C. Duplicación y código muerto
- `calcularSubtotal` es alias de `subtotalLinea` (2 consumidores).
- `formatDate` redefinido en `PortalNotificationsBell.tsx:23` (existe canónico en `lib/formatters/dates.ts`).
- `crmToast.ts` reimplementa `success/error` de `appFeedback.ts`; sólo `undo` es nuevo.
- 3 capas de toast paralelas: `useToast` (shim), `appFeedback` (canónico) y `crmToast`.
- 3 archivos Sentry sueltos en `src/lib/` (`sentry.ts`, `sentryHelpers.ts`, `sentryUser.ts`) con re-exports redundantes pudiendo vivir en `src/lib/observability/`.
- `src/constants/authMessages.ts` y `wizardConstants.ts`: 0 importadores.
- `src/lib/ui/uiMappings.ts`: barrel sólo renombra `ROLE_LABELS → roleLabels`.
- Magic strings de estado (`"Activo"`, `"Pendiente"`, `"Inactivo"`) en 35+ archivos sin enum central.
- Patrón `value.toFixed(1) + "%"` inline en 10+ sitios; `pctPnl` ya existe.
- Magic strings de roles inline en `appRoutes.tsx:54-101` (9 arrays) cuando ya existe `roleCatalog.ts`.
- `EmptyState` vs `EmptyStateInline`: fusionables con prop `size`.
- `knip.json` con `exports: "warn"` + ignores genéricos → reporta 0 issues falsamente.

### D. Complejidad y best practices
- **21 casts `as Type` en servicios productivos** sin `SAFE-CAST` ni centralización en `cast.ts` (lista completa: comisiones, costeo, cxp, facturas, embarques, admin, cotizacion, crm, proformas, proveedor, lib/import, lib/mappers).
- **7 `useEffect` con timers sin cleanup**: `CargaCfdiSection`, `useLoginAudit`, `TrackingNavieraActions`, `ErrorDetailsDialog`, `TabExportar`, `ResetPassword`, `ForgotPasswordDialog`.
- **Inline styles fuera de PDF**: `ChartSkeleton`, `VirtualRow`, `VirtualDataTable`, `VirtualTableParts`, `progress.tsx`, `PdfPreview.tsx` (host).
- PDFs en `src/pdf/**` usan inline styles obligatorios por API de `react-pdf` pero no están marcados con `// PDF-STYLE:`.

### E. Estructura y naming
- Carpetas en kebab-case rompiendo convención camelCase: `src/components/dashboard-ejecutivo/`, `src/pages/admin-org/`, `src/services/pagos-factura/`, `src/features/admin/components/org-detalle/`.
- `src/lib/queryClient.ts` y `queryPersistBootstrap.ts` deberían estar dentro de `src/lib/query/`.
- Context fuera de `contexts/`: `src/features/embarques/hooks/cotizacionVinculadaContext.ts`.
- Tests huérfanos en `src/hooks/__tests__/` que prueban hooks ya migrados a features (`useAdminOrgDetalle`, `useConfiguracionState`, `useEmbarquesListData`).

### F. Edge functions (`supabase/functions/`)
- 20/20 sin tests automatizados.
- **Críticas sin tests ni helpers**: `parse-cfdi-xml` (211L), `facturapi-emitir` (165L), `user-management` (87L), `send-transactional-email` + `process-email-queue` (pipeline de email).

---

## 🪜 Plan de Refactor Priorizado

### Fase 1 — Crítico (rompe encapsulación o riesgo fiscal/seguridad)
1. **Fusionar `features/facturacion` + `features/facturas`** en `features/facturas/` con `components/`, `hooks/`, `services/`, `types/`. Elimina ciclo de 20 refs y la partición artificial.
2. **Romper ciclo `admin ↔ configuracion`**: exponer `TabNavieras/TabPuertos/TabTiposContenedor` por barrel público de `configuracion`; `TabExportar` deja de importar de `admin/services` (mover `exportOrganizationZip` a `admin/services` consumido por hook compartido).
3. **Eliminar `features/misc/`**: reubicar entradas de `queryKeys` en la feature dueña (bitácora → dashboard, trackingLinks → embarques, etc.).
4. **Encapsular `Unsubscribe.tsx`**: crear `src/services/unsubscribeService.ts` (`validateToken`, `confirmUnsubscribe`) y eliminar `fetch()` raw + `VITE_SUPABASE_*` del componente.
5. **Centralizar 21 casts de servicios productivos**: mover a `src/lib/supabase/cast.ts` o anotar con `// SAFE-CAST: <razón>` y registrar en `bun run audit:casts`.
6. **Tests críticos de edge functions fiscales**: añadir cobertura a `facturapi-emitir`, `facturapi-cancelar` y `parse-cfdi-xml` (extraer `helpers.ts` primero).

### Fase 2 — Alto (acoplamiento y reglas de negocio en UI)
7. **Extraer reglas de negocio de bandejas a `features/bandejas/domain/`**:
   - `esProformaAtrasada(dias)`, `DIAS_LIMITE_PROFORMA`
   - `esCxpVencida(dias)`, totales/agregaciones de Cartera, CxpPorPagar, CxpPorCapturar
   - `calcularTotalesPorMoneda(cuentas)` a `features/tesoreria/domain/saldos.ts`
8. **Reubicar formateadores de dominio**: `maskClabe` → `src/lib/formatters/banking.ts`; `transporteLabel` → `src/lib/formatters/embarque.ts`; helper de tiempo relativo en `src/components/shared/bitacora/constants.ts` → `src/lib/utils/time.ts`.
9. **Crear hooks envolventes** para queries que viven en pages: `useTrackingPublico(token)`, `usePdfCotizacionData(id)`, `usePortalEmbarquesController` (con `statusCounts` precalculado).
10. **Extraer loops bulk-insert** de `Clientes.tsx` y `ProveedoresImportDialog.tsx` a `features/<dominio>/services/bulkImport.ts`.
11. **Migrar servicios globales a sus features**:
    - `src/services/pagos-factura/` → `features/facturas/services/pagos.ts`
    - `src/services/storage/facturas.ts` → `features/facturas/services/storage.ts`
    - `src/services/organization/` → `features/admin/services/organization.ts`
    - `src/services/planes/` → `features/admin/services/planes.ts`
    - `src/services/csf/` → `features/configuracion/services/csf.ts`
    - `src/hooks/usuario/` → `features/admin/hooks/`
12. **Cleanup de timers en 7 `useEffect`**: añadir `return () => clearTimeout(id)`.
13. **Romper ciclo `cliente ↔ reportes`**: `useRentabilidadClientes` vive en `reportes/hooks/`, cliente lo consume.

### Fase 3 — Medio (consolidación y consistencia)
14. **Unificar toast/feedback**: añadir `notifyUndo()` a `appFeedback`, eliminar `crmToast.ts`, planear retiro del shim `useToast`.
15. **Consolidar Sentry** en `src/lib/observability/sentry/` (init + helpers + user); eliminar re-exports puente.
16. **Centralizar magic strings**: `src/constants/estados.ts` (`ESTADO_PROFORMA`, `ESTADO_CONCILIACION`, `ESTADO_REVISION`); usar `FINANCE_ROLES`/`CONTABILIDAD_ROLES`/`ADMIN_ONLY_ROLES` en `roleCatalog.ts` para sustituir arrays inline en `appRoutes.tsx`.
17. **Promover `formatPercent`/`pctPnl`** al barrel `lib/formatters` y reemplazar `toFixed(1) + "%"` inline.
18. **Eliminar duplicados**: `calcularSubtotal` (alias), `formatDate` local en `PortalNotificationsBell`, `uiMappings.ts` (alias innecesario).
19. **Subdividir hooks-controller >190 líneas**: `useNuevoProveedorController`, `useNuevaFacturaProveedorForm` en sub-hooks por paso.
20. **Helpers + tests en edge functions restantes**: `auditoria-snapshot-daily`, `auditoria-weekly-digest`, `send-transactional-email`, `process-email-queue`, `client-error-log`, `tracking-public`, `user-management`, `demo-access`.

### Fase 4 — Bajo (higiene y opcionales)
21. **Naming uniforme camelCase** para 4 carpetas en kebab-case (renames con `mv`, ajustar imports).
22. **Inline styles fuera de PDF**: migrar `ChartSkeleton`, `VirtualRow`, `VirtualDataTable`, `VirtualTableParts`, `progress.tsx` a clases Tailwind o CSS variables. Marcar `// PDF-STYLE:` los inevitables en `src/pdf/**`.
23. **Mover `queryClient.ts` y `queryPersistBootstrap.ts`** a `src/lib/query/`.
24. **Reubicar `cotizacionVinculadaContext.ts`** a `features/embarques/contexts/`.
25. **Mover tests huérfanos** de `src/hooks/__tests__/` a las features destino.
26. **Eliminar archivos sin importadores**: `authMessages.ts`, `wizardConstants.ts` (verificar con git history primero).
27. **Mover `queryKeys.ts`** de raíz de cada feature a `<feature>/services/queryKeys.ts` (20 features).
28. **Añadir `types/` y `domain/`** a features que carezcan, empezando por `cxp`, `comisiones`, `tesoreria`, `dashboard`.
29. **Unificar convención de routing**: elegir `features/*/routes/` o `src/pages/*` y migrar los rezagados.
30. **Endurecer `knip.json`**: `exports: "error"`, quitar ignore genérico de `features/*/index.ts`.
31. **Ampliar `scripts/audit-architecture.ts`** para detectar carpetas kebab, features incompletas y ciclos cross-feature.
32. **Unificar `EmptyState` + `EmptyStateInline`** en un solo componente con prop `size`.

---

## 🧭 Cómo proceder

Sugiero abordarlo en sprints cortos. Si apruebas el plan, recomiendo empezar por la **Fase 1 punto 5 (centralizar los 21 casts)** porque es de bajo riesgo y elimina deuda silenciosa, y luego planificar la **fusión `facturacion + facturas`** como migración estructural mayor en una rama dedicada. Dime si prefieres reordenar fases, ampliar el detalle de alguna o ejecutar directamente algún paso.
