# Auditoría de arquitectura

## Nota previa importante

El sandbox se reinició entre sesiones y se **perdieron las migraciones de v8.96-v8.98** (el changelog en disco está en v8.95.0). Lo único que persistió fue el split del archivo de changelog v8/v4 en chunks. Esta auditoría refleja el estado **actual real** del código, no el reportado en mensajes anteriores.

## Estado general

Arquitectura **sana**. Hallazgos positivos:

- **Cero** imports directos de Supabase desde `src/components/` o `src/pages/` (solo desde `src/services/`, `src/contexts/`, `src/integrations/`).
- Solo **5 archivos** en `components/pages` importan de `src/services/` directamente (acoplamiento mínimo y justificado).
- `src/services/` ya migró al patrón folder/barrel para los dominios principales (cliente, cotizacion, embarque, proforma, admin, auth, csf, dashboard, etc.).
- `src/hooks/` está bien agrupado por dominio (catalogos, configuracion, cliente, cotizacion, embarque, facturacion, portal, proveedor, dashboard, admin, reportes).
- TypeScript build limpio.
- Componente más grande (excluyendo shadcn) son **227 LOC** (`PortalEmbarqueDetalle`), por debajo de umbral problemático.

No hay deuda arquitectónica grave. Las 5 mejoras siguientes son **higiene táctica** ejecutables en un solo paso.

---

## 5 mejoras (ejecutables en 1 paso)

### 1. Eliminar 28 shims muertos y consolidar imports (CRÍTICO higiene)

Hay 28 archivos de 1-2 líneas que solo re-exportan a la ubicación canónica. Confunden a la AI y a desarrolladores nuevos sobre cuál es la fuente oficial.

- **12 hooks shim** (`src/hooks/use*.ts` → `hooks/{catalogos,configuracion,portal}/...`): useConfiguracion, useConfiguracionGlobal, useConfiguracionOrg, useConfiguracionState, useExchangeRates, useOperadoresDistintos, usePortalDashboardKpis, usePortalData, usePortalDocumentDownload, usePuertos, useTasaIVA, useTiposContenedor.
- **5 hooks shim adicionales** (2 LOC): useClientes, useDashboardData, useFacturas, useNavieras, useProveedores → hooks/{cliente,dashboard,facturacion,catalogos,proveedor}.
- **9 services shim** (1-2 LOC): authService, bitacoraService, catalogosService, configuracionService, csfService, dashboardService, facturasService, searchService, usuarioService, storage → services/{auth,bitacora,...}.
- **1 component shim**: `components/shared/ProfitBadge.tsx` → `components/ProfitBadge.tsx`.
- **1 lib shim**: `lib/ui/wizardFeedback.ts` → `lib/ui/appFeedback.ts` (si appFeedback no existe aún, mantener wizardFeedback como canónico — verificar antes).

Acción: reapuntar todos los importadores con `sed` y borrar los shims (~70 imports actualizados, 28 archivos eliminados).

### 2. Crear API global de feedback `appFeedback.ts` y migrar consumidores

Hoy solo existe `src/lib/ui/wizardFeedback.ts` con `notifyError/Warning/Success`, pero su nombre sugiere uso exclusivo del wizard de embarques. Hay ~50 archivos en la app (pages, hooks, dialogs) que siguen usando `toast({ variant: "destructive" })` inline en vez del helper.

Acción:
- Renombrar `wizardFeedback.ts` → `appFeedback.ts` con la misma API (sin cambios de tipos).
- Migrar las ~120 llamadas inline a `notifyError`/`notifySuccess`/`notifyWarning` siguiendo la heurística: toast con `variant: "destructive"` → notifyError; toast con palabras clave (creado/eliminado/guardado/aprobado/...) → notifySuccess.
- Beneficio: severidad uniforme en toda la app, no solo en el wizard.

### 3. Extraer 2 controllers pendientes (`PortalEmbarques`, `Operaciones`)

Son los únicos pages con ≥4 useState y ≥150 LOC sin controller dedicado, rompiendo el patrón aplicado al resto en v8.90-v8.92.

- `PortalEmbarques.tsx` (169 LOC, 4 states): mezcla queries (clientes vinculados + embarques), filtros (search/estado/modo) y agrupamiento por expediente.
- `Operaciones.tsx` (155 LOC, 4 states): mezcla estado de filtros (periodo, operadorChart) con derivados (chartData, balancePct, contPct, totalAlertas).

Acción: crear `src/hooks/portal/usePortalEmbarquesController.ts` y `src/hooks/operaciones/useOperacionesPageController.ts`. Cada page queda como UI + composición.

### 4. Centralizar mensajes de error de validación (catálogo)

`src/lib/domain/embarqueWizardSchemas.ts` (322 LOC) es el archivo más grande del proyecto excluyendo generados, en gran parte por mensajes de error inline en cada `z.string().min(1, "Campo: razón.")`. Esto produce variaciones sutiles del mismo mensaje y hace imposible cambiar tono/idioma globalmente.

Acción:
- Crear `src/lib/domain/errorCatalog.ts` con dictionary de claves estables (`"2.eta.afterEtd"`, `"3.documento.tooLarge"`) + `FIELD_LABELS` + helpers `msg(key)` y `getMessage(key, params)` para interpolación.
- Crear `src/lib/domain/validationFormat.ts` con `formatValidationMessage(field, reason)` para evitar ciclos.
- Refactorizar el schema para consumir el catálogo (el archivo baja a ~250 LOC de pura definición de schemas).

### 5. Promover `components/shared/` y resolver duplicación PL

`src/components/shared/` solo contiene `ProfitBadge` (shim, ya cubierto en mejora 1) y `ValidationAlert.tsx` (componente real usado por los Step components).

Además, `src/components/cotizacion/` tiene 3 componentes con nombres confusamente similares (`SeccionCostosInternosPLDetalle`, `SeccionCostosInternosPLLocal`, `SeccionCostosInternosPLUnificado`). Tras inspección **NO son duplicación** — son dispatcher + 2 implementaciones especializadas — pero los nombres no lo comunican.

Acción:
- Mover `ValidationAlert.tsx` a `src/components/feedback/ValidationAlert.tsx` (carpeta nueva para futuros componentes de feedback transversales).
- Borrar el shim `shared/ProfitBadge.tsx` (cubierto en mejora 1).
- Borrar la carpeta `src/components/shared/`.
- Añadir comentario JSDoc claro al dispatcher PL para evitar confusión sin renombrar (renombrado romperia muchos imports sin beneficio neto).

---

## Detalle técnico

- **Verificación**: tras los 5 cambios correr `bunx tsc --noEmit` y `bunx vitest run` (objetivo: tests verde).
- **Sin cambios de comportamiento visible**: refactor estructural puro — no se tocan queries, RLS, lógica de negocio ni UI visual.
- **Changelog**: una entrada `v8.96.0` (minor) describiendo la limpieza arquitectónica completa.
- **Riesgo del reset**: el sandbox podría reiniciarse de nuevo. Las 5 mejoras se aplican y se verifican atómicamente al final del turno; si el reset ocurre tras el commit del turno, los cambios persistirán.

## Lo que NO se incluye (descartado tras revisión)

- Partir `CotizacionWizardLayout.tsx` (222 LOC): es composición declarativa, ya está bien.
- Reorganizar `src/lib/`: ya tiene capas correctas (domain, financial, formatters, mappers, parsers, ui, errors, query, storage, contacto).
- Tocar `src/integrations/supabase/types.ts`: autogenerado.
- Renombrar `SeccionCostosInternosPL{Detalle,Local,Unificado}`: alto churn, bajo beneficio.
