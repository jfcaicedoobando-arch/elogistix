# Centralizar Query Keys en `lib/query`

## Objetivo

Eliminar los **94 literales `queryKey: ["..."]`** y **16 spreads** dispersos en el código, moviéndolos al factory central `src/lib/query/index.ts`. Resultado esperado: **0 strings hardcodeados de queryKey fuera de `lib/query`**, e invalidaciones consistentes via factories.

## Diagnóstico

- `src/lib/query/index.ts` ya existe con ~22 dominios cubiertos (embarques, clientes, facturas, etc.).
- Literales restantes (44 archivos, 110 ocurrencias):
  - **CRM** (~50): `["crm", "actividades", ...]`, `["crm", "leads", ...]`, `["crm", "oportunidades", ...]`, dashboard, lineage, comentarios, plantillas, notificaciones, motivos, forecast, leaderboard, cliente-360, etapas, reportes.
  - **Auditoría** (~5): `["auditoria", "revisiones" | "snapshots" | "asignables" | "embarques"]`.
  - **Admin/Logs** (~4): `["app_logs", ...]`, `["app_logs_health_summary"|"timeline"]`.
  - **Facturación** (~2): `["facturacion", "hueco" | "proyeccion"]`.
  - **Misc** (~4): `["idempotencia-log"]`, `["papelera", tabla]`, `["pdf-preview-cotizacion", id]`, `["tracking-public", token]`, `["tracking_externo", "jsoncargo", ...]` (este último ya tiene factory `queryKeys.jsonCargo` pero no se usa).
- 16 spreads `[...queryKeys.X, ...]` ya consumen factories; se pueden promover a métodos para evitar el spread inline.
- Hay **157 llamadas a `invalidateQueries`** que pueden beneficiarse del prefijo correcto (usar `queryKeys.crm.actividades.all` invalida todo el subárbol).

## Estrategia

Para mantener PRs revisables y tests verdes en cada paso, dividir por dominio. Cada paso = un commit/loop.

### Estructura propuesta de factories nuevos

Agregar al `queryKeys` central, agrupados por dominio:

```ts
crm: {
  all: ['crm'] as const,
  actividades: {
    all: ['crm','actividades'] as const,
    list: (filters) => ['crm','actividades', filters] as const,
    vencidasCount: (uid?: string) => ['crm','actividades','vencidas-count', uid] as const,
    vencidasList: (uid?: string, limit?: number) => [...],
  },
  leads: {
    all: ['crm','leads'] as const,
    list: (filters) => ['crm','leads', filters] as const,
    detail: (id: string) => ['crm','leads','detail', id] as const,
  },
  oportunidades: { all, list, detail, cotizaciones(opId) },
  dashboard: (uid?) => ['crm','dashboard', uid] as const,
  comentarios: (opId, limit?) => [...],
  lineage: { lead, opCots, opEmbs, opLead },
  plantillas: (canal?, soloActivas?) => [...],
  notificaciones: { all, unreadCount(uid), list(uid, limit) },
  motivos: (soloActivos?) => [...],
  forecast: (desde, hasta) => [...],
  leaderboard: ['crm','leaderboard-vendedores'] as const,
  cliente360: (clienteId) => [...],
  etapas: { all, todas },
  reportes: ['crm','reportes'] as const,
  proximasActividades: (entidadTipo, ids) => [...],
  kpis: ['crm','kpis'] as const,
},
auditoria: {
  all: ['auditoria'] as const,
  revisiones: ['auditoria','revisiones'] as const,
  embarques: ['auditoria','embarques'] as const,
  snapshots: (dias?) => ['auditoria','snapshots', ...(dias ? [dias] : [])] as const,
  asignables: (orgId) => ['auditoria','asignables', orgId] as const,
},
appLogs: {
  all: ['app_logs'] as const,
  list: (filters) => ['app_logs', filters] as const,
  fnList: ['app_logs','fn_list'] as const,
  healthSummary: (hours) => ['app_logs_health_summary', hours] as const,
  healthTimeline: (hours, buckets) => ['app_logs_health_timeline', hours, buckets] as const,
},
facturacion: {
  hueco: (orgId) => ['facturacion','hueco', orgId] as const,
  proyeccion: (orgId, mesKey) => ['facturacion','proyeccion', orgId, mesKey] as const,
},
papelera: (tabla) => ['papelera', tabla] as const,
idempotenciaLog: ['idempotencia-log'] as const,
pdfPreviewCotizacion: (id) => ['pdf-preview-cotizacion', id] as const,
trackingPublico: (token) => ['tracking-public', token] as const,
```

También promover los 16 spreads a métodos del factory existente (ej. `queryKeys.embarques.full(id)`, `queryKeys.dashboard.statsSummary`, `queryKeys.clientes.selectByOrg(orgId)`, etc.) para eliminar `[...queryKeys.X, ...]` inline.

## Pasos (ordenados, un loop cada uno)

1. **Extender factory en `lib/query/index.ts`** con los nuevos dominios listados arriba (sin tocar consumidores aún). Añadir comentarios JSDoc breves. **Verificación:** `tsc --noEmit` verde.
2. **Migrar CRM** (~22 archivos en `hooks/crm/`). Reemplazar literales por `queryKeys.crm.*`. Ajustar `invalidateQueries` para usar el prefijo más amplio cuando aplique. **Verificación:** `vitest run hooks/crm` + smoke CRM.
3. **Migrar Auditoría** (`hooks/auditoria/*`). Mismo patrón.
4. **Migrar Admin/Logs** (`hooks/admin/useAppLogs*`, `useAlertasSistema`, `useOrgMembers*`).
5. **Migrar Facturación + misc** (`useHuecoFacturacion`, `useTabProyeccionController`, `Papelera.tsx`, `Idempotencia.tsx`, `PdfPreviewCotizacion.tsx`, `TrackingPublico.tsx`, `useJsonCargoTracking.ts`).
6. **Promover los 16 spreads** a métodos del factory (embarques.full, dashboard.statsSummary, etc.) y reemplazar usos.
7. **Guardrail ESLint:** añadir regla `no-restricted-syntax` que prohíba `Literal[value=/^queryKey$/]` con array literal hijo fuera de `src/lib/query/**`. Permite detectar regresiones en CI.
8. **Verificación final + changelog:**
   - `rg "queryKey:\s*\[\"" src` → 0 resultados fuera de `lib/query`.
   - `bunx vitest run` (626 verdes).
   - `bunx tsc --noEmit` + `bunx eslint src` sin errores.
   - Bump `APP_VERSION` minor (12.0.0) y entrada en `Changelog.tsx` + `changelogData.ts` + chunk activo (respetando límite de 10 entradas).

## Fuera de alcance

- Refactor de la lógica de fetch dentro de los hooks.
- Cambios de tipo `Result<T,E>` (paso P3 del plan general).
- Tocar `src/integrations/supabase/types.ts` o `components/ui/*`.

## Riesgos

- **Invalidaciones que dependían del shape exacto del array.** Mitigación: revisar cada `invalidateQueries` migrado y mantener el mismo prefijo; los tests existentes cubren los flujos principales.
- **Spreads con argumentos opcionales (`undefined`).** React Query distingue keys con `undefined` vs sin el elemento; preservar comportamiento exacto en factories.
- **Volumen (44 archivos).** Mitigado dividiendo por dominio en 5 loops independientes.
