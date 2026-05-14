# Architecture — Libre Carga

Guía de capas, reglas y convenciones del proyecto. **Mantener este contrato evita acoplamientos y simplifica los tests.**

> Última revisión: **v8.118.8 — 2026-05-08**
> Fuente espejo: `mem://technical/architecture-and-standards`.
> Documentación de dominio complementaria: [`docs/auditoria.md`](./docs/auditoria.md) (desglose de componentes y flujo de datos del módulo Auditoría), [`docs/tables.md`](./docs/tables.md) (estandarización de tablas y densidades).

## Tabla de contenidos

1. [Estructura de carpetas](#1-estructura-de-carpetas)
2. [Flujo de datos canónico](#2-flujo-de-datos-canónico)
3. [Reglas de capa](#3-reglas-de-capa)
4. [Hooks de dominio: convención de barrels](#4-hooks-de-dominio-convención-de-barrels)
5. [Services: cuándo crear / cuándo no](#5-services-cuándo-crear--cuándo-no)
6. [Transacciones complejas → RPC](#6-transacciones-complejas--rpc)
7. [Naming](#7-naming)
8. [React Query — convenciones](#8-react-query--convenciones)
9. [Performance / Lazy-loading](#9-performance--lazy-loading)
10. [RLS y multi-tenant](#10-rls-y-multi-tenant)
11. [Edge Functions](#11-edge-functions)
12. [Storage](#12-storage)
13. [Error handling y feedback](#13-error-handling-y-feedback)
14. [Localización (es-MX)](#14-localización-es-mx)
15. [Testing](#15-testing)
16. [Decisiones explícitas (con fecha)](#16-decisiones-explícitas-con-fecha)
17. [Decisiones de no hacer](#17-decisiones-de-no-hacer)
18. [Glosario](#18-glosario)
19. [Versionado (SemVer)](#19-versionado-semver)
20. [The Power of 10](#20-the-power-of-10-estándar-de-generación)

---

## 1. Estructura de carpetas

```text
src/
├── pages/          → Composición de UI por ruta. NO tocan Supabase ni lógica de dominio.
├── components/     → Componentes reutilizables y específicos de feature.
│   ├── shared/         → Canónicos: KpiCard, PageHeader, PageTabs.
│   ├── ui/             → shadcn read-only (no editar).
│   └── <dominio>/      → Componentes por feature (embarque, cotizacion, cliente, …).
├── hooks/          → React Query + estado local + side effects (toasts, navegación).
│   ├── admin/          → Barrel folder (organizaciones, miembros, planes).
│   ├── auditoria/      → Barrel folder.
│   ├── catalogos/      → Barrel folder (puertos, navieras, exchange-rates, …).
│   ├── cliente/        → Barrel folder.
│   ├── configuracion/  → Barrel folder.
│   ├── cotizacion/     → Barrel folder + barrel `useCotizaciones.ts`.
│   ├── dashboard/      → Barrel folder.
│   ├── embarque/       → Barrel folder + barrel `useEmbarques.ts` + `mutations/`.
│   ├── facturacion/    → Barrel folder.
│   ├── operaciones/    → Barrel folder.
│   ├── portal/         → Barrel folder.
│   ├── proveedor/      → Barrel folder.
│   ├── reportes/       → Barrel folder.
│   ├── shared/         → Hooks transversales (debounce, listPageState, permissions, sidebarAlerts).
│   └── usuario/        → Barrel folder.
├── services/       → Acceso puro a datos (Supabase, edge functions, fetch). Sin React Query.
├── lib/            → Utilidades puras y reutilizables.
│   ├── domain/         → Reglas de dominio (cálculos de estado, validaciones).
│   ├── mappers/        → Transformación entre formato DB ↔ UI.
│   ├── parsers/        → Parsing de payloads (CSF, dashboard).
│   ├── financial/      → Cálculos monetarios + IVA dinámico.
│   ├── formatters/     → Money/date/number en es-MX.
│   ├── ui/             → appFeedback, dialogTokens, kpiTones, uiMappings.
│   ├── query/          → Query keys centralizados.
│   └── *.ts            → utils, errors, storage, contacto.
├── content/        → Contenido editorial (changelog, copy de marketing).
├── constants/      → Constantes de dominio/UI (cotización, embarque, proveedor, wizard, appVersion).
├── types/          → Tipos compartidos entre módulos.
├── contexts/       → React Contexts (Auth, Organization, Theme, Breadcrumb).
├── generators/     → Generación de archivos (PDF, CSV).
└── integrations/   → Clientes auto-generados (Supabase). NO editar.

supabase/
├── functions/      → Edge functions (Deno). Cada carpeta = 1 función desplegada.
│   └── _shared/        → corsHeaders + handlePreflight + auth/response helpers.
├── migrations/     → SQL versionado (RPCs, RLS, índices, triggers).
└── config.toml     → Project-level config (no editar `project_id`; sí bloques `[functions.X]`).
```

## 2. Flujo de datos canónico

```text
   Page (UI route)
      │
      ▼
   Hook (useQuery / useMutation)
      │              ▲
      ▼              │ invalida cache
   Service (async puro)
      │
      ▼
   Supabase (.from / .rpc / .storage)
      │
      ▼
   Tables<'x'>  ──►  Mapper  ──►  Tipo UI
                                   │
                                   ▼
                              Component (renderiza)
```

Reglas implícitas: las flechas no se saltan. Una page no llama Supabase; un componente no llama React Query directamente fuera de su hook controller.

## 3. Reglas de capa

### 3.1 Pages NO tocan Supabase
Toda lectura/escritura debe pasar por un hook (`useEmbarque`, `usePrefetchEmbarque`, etc.) o un service.

❌ Mal:
```tsx
// src/pages/Embarques.tsx
const { data } = await supabase.from('embarques').select('*');
```

✅ Bien:
```tsx
// src/pages/Embarques.tsx
const { data } = useEmbarques();
```

### 3.2 Hooks vs Services

| | Service | Hook |
|---|---------|------|
| Responsabilidad | Acceso a datos puro | Orquestación de UI |
| React Query | ❌ no | ✅ sí (`useQuery`/`useMutation`) |
| Toasts/navegación | ❌ no | ✅ sí |
| Reutilizable fuera de React | ✅ sí | ❌ no |

Un service expone funciones async simples. Un hook envuelve uno o más services con cache, invalidación y feedback al usuario.

### 3.3 Componentes UI shadcn — read-only
Los archivos en `src/components/ui/` son shadcn intactos. **No editarlos**; si necesitas variar comportamiento, crea un wrapper. Se aplica también a `src/hooks/use-toast.ts` y `src/hooks/use-mobile.tsx`.

### 3.4 Datos sensibles
Nunca poner secrets en cliente. Las edge functions usan service-role; la UI usa la anon key. Ver §10 para multi-tenant y RLS.

### 3.5 Controllers de página
Las pages densas (>5 hooks o handlers) deben extraer su lógica a `use<Page>PageController` o `use<Entity>DetalleController`, dejando la page como composición pura de UI. Patrón canónico desde v8.85.0 (`useReportesPageController`, `useClienteDetalleController`).

## 4. Hooks de dominio: convención de barrels

**Folder + `index.ts` por dominio** (estabilizado en v8.100.4). Cada subcarpeta de `src/hooks/` es un dominio con su `index.ts` que re-exporta los hooks públicos:

- `admin`, `auditoria`, `catalogos`, `cliente`, `configuracion`, `cotizacion`, `dashboard`, `embarque`, `facturacion`, `operaciones`, `portal`, `proveedor`, `reportes`, `shared`, `usuario`.
- Importar siempre desde el barrel: `@/hooks/cliente`, `@/hooks/embarque`, etc. Importar de submódulos sólo cuando el barrel no expone esa API.
- Embarques y Cotizaciones conservan además los barrels legacy `@/hooks/embarque/useEmbarques` y `@/hooks/cotizacion/useCotizaciones` por compatibilidad (re-exportan tipos + queries + mutations agrupadas).
- `hooks/embarque/mutations/` agrupa create/update/delete con su propio `index.ts` por tamaño y rotación de la carpeta.

En `src/services/` la convención (desde v8.86.0) es **folder + `index.ts`**:

- Cada dominio es una carpeta con `index.ts` que re-exporta sus submódulos.
  Ejemplo: `src/services/cliente/{index,crud,contactos,relacionados,financials}.ts`.
- Naming sin sufijo: la carpeta se llama por el dominio en singular (`cliente`, `embarque`, `cotizacion`, `proforma`, `admin`, `portal`, `auditoria`, `bitacora`, `tracking`, `storage`, `auth`). Nada de `xService.ts` o `xServices.ts` sueltos.
- Import desde el barrel: `@/services/<dominio>`. Importar de submódulos (`@/services/cliente/crud`) está permitido pero no es lo idiomático.

Misma convención en `src/lib/` (formatters, financial, storage, ui, errors, contacto, query). Excepción: `src/lib/utils.ts` y `src/lib/mappers/*.ts` (mappers no son barrels).

## 5. Services: cuándo crear / cuándo no

**Crear** cuando:
- La UI necesita llamar a una edge function (ej. `trackingService`).
- Existe lógica de transformación de payload no trivial.
- Múltiples hooks comparten el mismo acceso a datos.

**No crear** cuando:
- El acceso es trivial (`.from('x').select(...)` directo) y vive en un solo hook.
- Sería un wrapper 1:1 sin valor.

### 5.1 Convención `queries + mutations + subdominios`

Estabilizada en v8.139.0 (`services/embarque/queries/`) y v8.141.0 (`services/cotizacion/{queries,mutations}.ts`). Aplica cuando un dominio crece más allá de un único `crud.ts`:

- `queries.ts` (o `queries/` con sub-archivos por agregado) — sólo lecturas y constantes de columnas reutilizables (`<DOMINIO>_LIST_COLUMNS`).
- `mutations.ts` — inserts/updates/deletes y orquestación de RPCs.
- Subcarpetas por subdominio cuando hay flujos especializados (`costos/`, `conversiones/`, `wizard/`, `colaterales/`, `expedientes/`).
- El `index.ts` del dominio re-exporta todo; los hooks importan SIEMPRE desde el barrel `@/services/<dominio>`.
- No mezclar lecturas y escrituras en el mismo archivo; eso bloquea el split por tamaño y dificulta razonar sobre cache/invalidaciones.

## 6. Transacciones complejas → RPC

Cuando una operación implica **múltiples escrituras dependientes** (insertar cabecera + N detalles, snapshots consolidados, encadenar facturación con conceptos), debe implementarse como una **función RPC** en `supabase/migrations/` y consumirse vía `supabase.rpc('nombre_funcion', { ... })` desde el service.

**Por qué**: los rollbacks manuales en JS (try/catch + delete del registro padre) no son atómicos. Si el cliente pierde la red entre dos pasos, la base queda en estado inconsistente. Una función RPC corre en una sola transacción de Postgres y garantiza atomicidad real.

**Patrón**:
1. Migración SQL define `create or replace function public.<accion>(...) returns ... language plpgsql security definer`.
2. `services/<dominio>/index.ts` (o submódulo del barrel) expone una función async que invoca `supabase.rpc(...)`.
3. El hook (`useMutation`) solo orquesta cache e invalidaciones.

Ejemplos canónicos en el repo: `crear_proforma_con_conceptos`, `consolidar_proformas`, `eliminar_embarque_cascada`.

## 7. Naming

- **Dominio (negocio)**: español. `useEmbarques`, `cotizacion/index.ts`, `Cotizaciones.tsx`.
- **Utilitarios técnicos**: inglés. `useDebounce`, `formatters.ts`, `useListPageState`.
- **Hooks**: `use<Sustantivo>` (`useEmbarque`) o `use<Sustantivo><Acción>` (`useEmbarqueMutations`, `useCotizacionQueries`).
- **Controllers de página**: `use<Page>PageController` (`useReportesPageController`) o `use<Entity>DetalleController` (`useClienteDetalleController`).
- **Tipos**: PascalCase singular. `Cotizacion`, `EmbarqueRow`, `CreateCotizacionInput`.
- **Componentes**: PascalCase descriptivo, prefijo de feature cuando ayuda. `EmbarqueWizard`, `ReportesKpiCards`.
  - **Diálogos**: `Dialog<Acción><Entidad>` (`DialogGenerarProforma`, `DialogEditarCliente`, `DialogContacto`).
  - **Selects de catálogo**: `<Entidad>Select` (`PortSelect`, `NavieraSelect`).
- **Services**: verbo en infinitivo. `fetchEmbarqueParaPdf`, `crearProforma`, `eliminarEmbarqueCascada`.
- **Archivos de tipos compartidos**: en `src/types/`, nombrados por dominio (`cotizacion.ts`, `cotizacionPL.ts`).

## 8. React Query — convenciones

- **Query keys**: centralizados en `src/lib/query/index.ts` (export `queryKeys`). No usar arrays inline en hooks.
- **`staleTime` por tipo de dato**:
  - Catálogos (puertos, navieras, conceptos): `5 * 60 * 1000` (5 min).
  - Datos operativos (embarques, cotizaciones, facturas): `30 * 1000` (30 s).
  - Reportes y KPIs: `60 * 1000` (1 min).
  - Auth/perfil: ver `useAuthProfile` (TTL custom + de-dupe).
- **Invalidación**: el hook que ejecuta la mutación invalida sus keys; **nunca** desde el componente.
- **Selecciones explícitas**: en queries de lista, especificar columnas (`.select('id, expediente, ...')`) para reducir payload. Ver `mem://technical/optimizacion-consultas`.
- **Paginación servidor**: módulos de Clientes, Proveedores y Embarques usan `useListPageState` + paginación server-side.

## 9. Performance / Lazy-loading

- **Páginas lazy**: `React.lazy` en el router para todas las rutas excepto `/login` y la raíz.
- **Generadores PDF**: `import("@/generators/<x>Pdf")` dinámico en hooks que disparan la descarga. jsPDF (~200 KB) no debe entrar en el bundle inicial.
- **Datasets grandes**: patrón changelog — entrada actual eager (`recentChangelog`), histórico lazy (`loadChangelogV8`, `loadLegacyChangelog`).
- **Recuperación de chunks**: ante "Failed to fetch dynamically imported module" se aplica recarga automática (ver `mem://technical/chunk-load-recovery`).
- **Regla general**: cualquier dependencia >50 KB que no sea crítica para el primer render debe lazy-loadearse.
- **Memoización**: `useMemo`/`React.memo` solo cuando hay evidencia (listas grandes, render frecuente). No memoizar por defecto.

## 10. RLS y multi-tenant

- **`organization_id`** en toda tabla de dominio. Las RLS filtran por `is_org_member(organization_id)` o equivalente.
- **Roles** viven en `public.user_roles` (enum `app_role`), nunca en `profiles` ni en `auth.users` (anti-escalación de privilegios).
- **Roles por organización**: además de `user_roles` (global) existe `organization_members(role)` y la función `has_org_role(user_id, org_id, role)` para acciones limitadas a una org.
- **Policies** usan funciones `security definer` (`has_role`, `is_org_member`, `has_org_role`) para evitar recursión RLS.
- **Operaciones cross-org** (admin, super-admin) pasan por RPC `security definer` que validan rol antes de actuar.
- **Edge functions**: usan service-role key para acciones administrativas; la UI nunca recibe esa key.
- **Portal de clientes**: ver `mem://technical/security-patterns` para el patrón de escritura con rol read-only vía RPC.
- **`OrganizationContext`** (`src/contexts/OrganizationContext.tsx`): expone la org **efectiva**, considerando impersonación de super-admin. Toda query/mutation que filtre por tenant debe consumir esta org efectiva (no `user.organization_id` directo).
- **Impersonación super-admin**: el `OrgSwitcher` cambia la org efectiva sin cerrar sesión. `effectiveRole` del `AuthContext` refleja el rol del usuario en la org activa; UI sensible (Configuración, Usuarios) se condiciona por `effectiveRole`, no por `role` global.

## 11. Edge Functions

- Carpetas: `supabase/functions/<nombre>/index.ts`. Cada carpeta = una función desplegada. Despliegue automático tras editar (no pedir al usuario que despliegue).
- **CORS**: importar siempre `corsHeaders` y `handlePreflight` de `supabase/functions/_shared/cors.ts`. Manejar OPTIONS antes de cualquier otra lógica:
  ```ts
  const pre = handlePreflight(req); if (pre) return pre;
  ```
- **Helpers compartidos**: `_shared/auth.ts` (validación de JWT/rol) y `_shared/response.ts` (respuestas JSON estándar).
- **`verify_jwt`**: por defecto las funciones internas requieren JWT. Sólo se desactiva en `supabase/config.toml` para funciones públicas (ej. `tracking-public`, `exchange-rates`).
- **Naming**: kebab-case, verbo + sustantivo. `create-user`, `delete-user`, `invite-client-user`, `parse-csf`, `tracking-public`, `exchange-rates`, `list-users`.
- **Service-role**: sólo dentro de la función. Nunca devolver tokens al cliente. Validar el caller (rol global o por org) antes de ejecutar acciones administrativas.
- **Consumo desde UI**: vía `supabase.functions.invoke(name, { body })` desde un service (`@/services/<dominio>`), nunca desde un componente o page.

## 12. Storage

- **Buckets**: `documentos` para archivos de embarques/cotizaciones/clientes; `facturas` para PDFs/XML CFDI emitidos.
- API centralizada en `src/services/storage/index.ts` (`uploadFile`, `getFileUrl`, `getSignedUrl`, `deleteFile`). No invocar `supabase.storage.from(...)` desde hooks o componentes salvo casos justificados (ver `services/proforma/facturar.ts`).
- **Convención de paths**: `<dominio>/<organization_id>/<entidad_id>/<nombre_archivo>` (ej. `embarques/<org>/<embarque>/bl_master.pdf`). Mantener `organization_id` en el path facilita políticas y limpieza por tenant.
- **URL pública vs firmada**: `getSignedUrl` (default 1h) para documentos sensibles; `getPublicUrl` sólo para assets ya públicos.
- **Subida desde UI**: siempre vía un hook de mutation que invalide la query del listado de documentos del padre.

## 13. Error handling y feedback

- **Catálogo de errores**: `src/lib/domain/errorCatalog.ts` mapea códigos Supabase / Postgrest / RPC a mensajes en es-MX. El toast genérico es mala UX; usar el catálogo.
- **`appFeedback`** (`src/lib/ui/appFeedback.ts`): wrappers `notifyOk` / `notifyError` / `notifyInfo` que estandarizan duración, ícono y tono. Los hooks de mutación llaman `appFeedback`, nunca `toast()` directo.
- **Validación de formularios**: Zod (`src/lib/domain/*Schemas.ts`) + React Hook Form. Mensajes en español. `setValue(..., { shouldValidate: true, shouldDirty: true })` + `trigger()` para updates programáticos (Core memory).
- **Recuperación de chunks**: `RouteLoadingFallback` + auto-reload ante "Failed to fetch dynamically imported module" (`mem://technical/chunk-load-recovery`).
- **Logs**: `console.error` en services/edge functions con contexto suficiente; nada de `console.log` ruidoso en código de producción.

## 14. Localización (es-MX)

- **Idioma único**: español de México. No introducir copy en inglés en UI ni en mensajes visibles.
- **Fechas**: `DD/MM/YYYY` (es-MX). Helpers en `src/lib/formatters/`. ISO sólo en BD/payloads.
- **Moneda**: base operativa **MXN**, vista financiera complementaria en **USD** (Frankfurter, cache 1h). Nunca hardcodear IVA — usar `useTasaIVA` y `lib/financial/financialUtils`.
- **Números**: separador de miles `,` y decimal `.`. Usar `formatCurrency` / `formatCurrencyCompact`.
- **Selects de ubicación**: prioridad **Puerto > Aeropuerto > Ciudad** (Core memory).

## 15. Testing

- **Stack**: Vitest + Testing Library. 279 tests vigentes (v8.118.8).
- **Qué se testea**:
  - `src/lib/` (financial, domain, storage, ui, mappers complejos, parsers): puro, alta cobertura. Incluye `*.edge.test.ts` para casos borde (montos cero/negativos, fechas nulas, conversiones round-trip).
  - `src/services/` puros con lógica no trivial (csfService, trackingService).
  - Hooks con orquestación compleja (`useEmbarquesListData`, `useConfiguracionState`, `useAdminOrgDetalle`, `usePermissions`, y la suite completa de `hooks/auditoria/__tests__/` — controller, ejecutivo, revisiones, tabla).
  - Funciones derivadas en constantes (`getDocsForMode`).
- **Qué NO se testea**:
  - Componentes shadcn ni wrappers triviales.
  - Pages (composición pura — se cubren vía tests de hooks/controller).
  - Mappers 1:1 sin lógica.
  - **Constantes literales y wrappers de terceros**: no testear arrays/objetos hardcodeados (es tautológico) ni funciones que sólo delegan a una librería externa (ej. `cn()` sobre `clsx + tailwind-merge`). Sí testear funciones que derivan/calculan a partir de la constante.
- **Ubicación**: carpeta `__tests__/` colocalizada junto al archivo bajo test. Convención de nombre: `<archivo>.test.ts`.
- **Wrappers para hooks**: tests de hooks que dependen de React Query envuelven con un `QueryClientProvider` fresco (cache aislado por test). Hooks que dependen de auth envuelven además con un `AuthContext.Provider` mockeado. Patrón canónico en `src/hooks/__tests__/usePermissions.test.tsx` y `useAdminOrgDetalle.test.ts`.
- **Comandos**: `bunx vitest run` (tests). `bunx tsc --noEmit` (type-check).


## 16. Decisiones explícitas (con fecha)

Estas decisiones son intencionales. **NO marcarlas como violación de capa** en futuras auditorías.

- **Mappers pueden importar `type Tables` de Supabase** (siempre). Los archivos en `src/lib/mappers/` traducen entre BD y UI; sin esos tipos no pueden cumplir su contrato.
- **`import type` no cuenta como violación de capa** (siempre). Una page o componente puede importar `type Tables<'contactos_cliente'>` desde `@/integrations/supabase/types`. Lo prohibido son llamadas runtime (`supabase.from`, `supabase.rpc`, `supabase.storage`, `supabase.functions`).
- **`src/content/` para contenido editorial** (v8.86.0, refinado en v8.89.0). El changelog y copy de marketing viven en `src/content/`. Desde v8.89.0 ya no existe `src/data/` (el catálogo de puertos vive en BD; no quedan datasets estáticos).
- **Barrel folder en `src/services/`** (v8.86.0). Eliminados los 5 barrel-archivo (`xService.ts`, `xServices.ts`); convención unificada a `<dominio>/index.ts`.
- **AuthContext modular** (v8.86.0). Dividido en `useAuthSession` + `useAuthProfile` + `useLoginAudit` + compositor delgado.
- **Auditoría de `useEffect`** (v8.86.0). Los 30 `useEffect` activos son legítimos y caen en 5 categorías:
  1. Sincronización de form (`reset(defaults)` al cambiar props).
  2. Subscripciones a APIs externas (Supabase auth, Theme, GlobalSearch).
  3. Hidratación de wizards de embarque.
  4. Hooks utilitarios (`useDebounce`, paginación reactiva).
  5. shadcn read-only (`sidebar.tsx`, `use-toast.ts`, `use-mobile.tsx`).

  Nuevos `useEffect` deben encajar en una de estas categorías o ser candidatos a refactor.
- **Lazy-load de jsPDF** (v8.87.0). `proformaPdf` y `cotizacionPdf` se cargan vía dynamic import. No revertir.
- **Tipos en `src/types/`** (v8.87.0). Eliminado el re-export legacy `useCotizacionTypes.ts`. Los tipos compartidos viven sólo en `@/types/cotizacion` y `@/types/cotizacionPL`.
- **Sistema de diseño unificado — Apple-inspired** (v8.100.3). Componentes compartidos canónicos en `src/components/shared/` (`KpiCard`, `PageHeader`, `PageTabs`) y `src/components/ui/toggle-group.tsx` para segmented controls. Reglas:
  - Sidebar activo: `bg-sidebar-accent/10` + `font-semibold` (sin bloques sólidos de alto contraste).
  - Header sticky global: `z-40` + `bg-card/95` con `backdrop-blur` (evita clipping de contenido al hacer scroll).
  - Grids de cards: `auto-rows-fr` + `h-full` para garantizar simetría vertical.
  - Breadcrumbs: mostrar `…` mientras se resuelven segmentos UUID (no exponer IDs crudos).
  - Loading de rutas: skeletons layout-aware en `RouteLoadingFallback.tsx` (no spinners globales).
  - Light mode: logo y avatar sin contenedor blanco/ring.
  - Detalle de embarque: sin botón "back" redundante cuando hay breadcrumbs.
- **Hooks barrel folder universal** (v8.100.4). Toda subcarpeta de `src/hooks/` expone un `index.ts`. Importar siempre por `@/hooks/<dominio>`; importar archivos sueltos sólo cuando el barrel no exponga la API.

## 17. Decisiones de no hacer

Aceptadas explícitamente; no son deuda pendiente.

- **Hooks Detalle fragmentados**: `useCotizacionDetalleState` + `useCotizacionDetalleHandlers` y `useEmbarqueDetalleActions` + `useEmbarqueEstadoActions` + `useEmbarqueDocumentosActions` mantienen su separación queries/mutations a propósito. Fusionarlos perjudicaría testabilidad sin reducir complejidad real.
- **Naming bilingüe**: regla §7 cubre el patrón es/en. No se renombran archivos existentes para evitar ruido en historial.
- **Re-exports legacy `@/data/*`**: eliminados por completo en v8.36.0. No reintroducir.
- **`costosPLTypes.ts`**: se conserva (no se mueve a `src/types/`) porque exporta el helper UI `calcTotalsPL` usado por las secciones P&L. Cambiar de carpeta no aporta valor.

## 17.b Type assertions policy (`as X`)

Política vigente desde v8.123.0. Compañera de
[`docs/cast-audit.md`](./docs/cast-audit.md) y
[`docs/strict-mode-roadmap.md`](./docs/strict-mode-roadmap.md).

| Categoría | ¿Permitido? | Comentario obligatorio |
|-----------|-------------|------------------------|
| **SAFE** — `as const`, `as React.*`, `as ReturnType<typeof X>` | Sí | No |
| **LOW** — `as Json`, `as unknown` aislado | Sí | Sí (`// cast: razón`) |
| **MEDIUM** — `as Tables<X>`, `as TablesInsert<X>`, `as TablesUpdate<X>` | Solo en `lib/mappers/*` y `services/*/queries.ts` | Sí |
| **HIGH** — `as unknown as X`, `as X[]` sobre respuesta sin validar | No (excepto tests con justificación escrita) | Obligatorio + revisor senior |
| **CRITICAL** — `as any`, `JSON.parse(...) as X`, casts entre tipos no relacionados | **No** | Bloquea el merge |

Para auditar el estado actual: `npm run audit:casts` (genera
`docs/cast-audit.md`). Baseline 2026-05-08: 559 casts, 73 HIGH+CRITICAL (~13 %).

## 18. Glosario

- **Embarque**: operación logística (importación, exportación, nacional, cross-trade, intra-UE). Identificado por **expediente**.
- **Expediente**: identificador único de embarque generado vía RPC en BD. Ver `mem://technical/shipment-identification-logic`.
- **Cotización**: propuesta comercial previa al embarque. Puede convertirse en uno o varios embarques.
- **Proforma**: documento de cobro previo al embarque liquidado. Puede ser regular o **consolidada** (agrupa conceptos de varios embarques).
- **Concepto**: línea de costo o venta dentro de un embarque/cotización/proforma. Catálogo estandarizado en `conceptos_*`.
- **P&L**: Profit & Loss; sección de la cotización que compara costos internos vs venta (USD y MXN).
- **CSF**: Constancia de Situación Fiscal (México). Se parsea para alta automática de clientes.
- **Incoterm**: término comercial internacional (EXW, FOB, CIF, …). Catálogo compartido entre embarques y cotizaciones.
- **Organización**: tenant del sistema. Toda fila de dominio pertenece a una organización vía `organization_id`.
- **Cliente**: empresa receptora del servicio. Vive dentro de una organización.
- **Operador**: usuario interno de la organización agente de carga.
- **Portal de clientes**: vista white-label que la organización expone a sus clientes finales.

---

## 19. Versionado (SemVer)

El proyecto sigue **Semantic Versioning** (`MAJOR.MINOR.PATCH`). Mantener `APP_VERSION` (`src/constants/appVersion.ts`), la entrada eager de `src/content/changelogData.ts` y la entrada en `src/content/changelog/v8/chunks/0.ts` siempre sincronizadas.

### Reglas para elegir el bump

| Bump | Cuándo | Ejemplos |
|------|--------|----------|
| **MAJOR** (`9.0.0`) | Rediseño global, cambio de modelo de datos que rompe migraciones, lanzamientos públicos hito | Multi-tenant inicial, rediseño completo del wizard, salida del prototipo a producción |
| **MINOR** (`8.x.0`) | Feature nueva visible para el usuario, módulo nuevo, RPC/edge function nueva, integración externa nueva | Nuevo módulo Auditoría, Portal de clientes, integración Frankfurter, nueva pantalla |
| **PATCH** (`8.x.y`) | Fixes, ajustes visuales/UX, refactors internos, copy, micro-mejoras sin nueva funcionalidad | Pulido visual, fix de bug, ajuste de etiqueta, decomposición de archivos, performance |

### Heurística práctica

- **Si el usuario no obtiene una capacidad nueva → es PATCH.** Pulido visual, refactor, fix, copy, perf, accesibilidad → siempre `.y`.
- **Si aparece un módulo, pantalla, endpoint, integración o flujo completo nuevo → es MINOR.** Bumpea `.0` y resetea el patch.
- **MAJOR se reserva** para hitos planificados (no se hace por una sesión grande de cambios).
- **Agrupa PATCHes**: 5 fixes el mismo día = un solo `.y` con bullets, no `.y+1..y+5`.
- **Tipo en cada entry del changelog** (`type: "minor" | "patch" | "major"`) debe corresponder al bump real; si hay desalineación, corregir en el momento (renumerar la entrada) y dejar nota explícita en la `description`.

### Anti-patrones documentados

- ❌ Bumpear MINOR por cada sesión de pulido visual (drift histórico que llevó la rama 8.x más allá de `.100`). Desde v8.100.3 se aplica la regla estricta de arriba.
- ❌ Crear varios PATCH consecutivos el mismo día por commits separados. Consolidar en uno.
- ❌ Cambiar `APP_VERSION` sin actualizar las dos entradas del changelog (eager + chunk).

## 20. The Power of 10 (estándar de generación)

Adoptado en v8.143.0. Inspirado en las "Power of 10 Rules" de la NASA, adaptado para React + Supabase + TypeScript. Aplica a **todo código nuevo y refactors**; el legacy se atiende por dominio según `docs/power10-baseline.md`. Versión condensada vive en `mem://principles/power-of-10` para que la IA generadora la cargue por defecto.

### 20.1 Reglas

1. **Flujo de control simple.** Early returns para `loading`/`error`. Sin ternarios anidados >1 nivel en JSX.
   ```tsx
   // ✅
   if (isLoading) return <Skeleton />;
   if (!data) return <Empty />;
   return <Tabla rows={data} />;

   // ❌
   return isLoading ? <Skeleton /> : data ? (data.length ? <Tabla/> : <Empty/>) : <Error/>;
   ```

2. **Límites de paginación en UI.** Toda query que alimente una **lista visible** debe paginar (`.range()` o `.limit()` explícito). Queries agregadas, exports y RPCs hacen su propia paginación interna documentada; **no** se aplica `.limit(20)` ciego a queries de KPIs.

3. **Cleanup obligatorio en `useEffect`.** Para `subscribe`, `setInterval`, `setTimeout`, `addEventListener` o canal Supabase Realtime. Para canales: `supabase.removeChannel(channel)` explícito. Ya es regla core.

4. **Componentes ≤200 líneas.** Si crece, extraer a `use<X>Controller` (lógica) y subcomponentes (UI). Wizards y diálogos complejos pueden llegar a 250 con justificación en comentario de cabecera. Tests, shadcn vendored (`src/components/ui/**`) y migraciones SQL exentos.

5. **Programación defensiva.** Tipos generados de Supabase, validación de existencia (`if (!data) return …`) y Error Boundaries por ruta principal. Prohibido `any` salvo override documentado en `§17.b`.

6. **Estado local primero.** `useState` por defecto; elevar a Context/store sólo si dos hermanos lo comparten realmente. Ya es regla core.

7. **Manejar errores de red.** Toda llamada Supabase verifica `error` y notifica vía `useToast` + `errorCatalog.ts`. Nunca asumir éxito.

8. **Stack estándar.** Vite + Tailwind + shadcn + React Query, sin macros ni scripts inyectados. Sin postprocesadores ad-hoc.

9. **Prop-drilling controlado.** A partir de **3 niveles** revisar composición o `useContext`. No es prohibición dura, es señal de refactor.

10. **Compilación limpia.** Cero warnings de TS/ESLint en build, cero `any`. Warnings residuales (chunk size, devtools) se resuelven antes de activar el bar como gate.

### 20.2 Aplicación

- **Fase 1 (v8.143.0):** Documentación + memoria — referencia obligatoria para la IA generadora.
- **Fase 2:** Baseline read-only en `docs/power10-baseline.md` con conteos por dominio (script `scripts/audit-power10.ts`).
- **Fase 3:** Endurecimiento de `eslint.config.js` (`no-explicit-any`, `exhaustive-deps`, `max-lines-per-function: 200` con overrides). Violaciones legacy se silencian con `// eslint-disable-next-line` + TODO; PRs nuevos no pueden agregar.
- **Fase 4:** Limpieza por dominio (auditoría → embarque → cotización → cliente → resto), un PR por dominio.
