# Architecture — Libre Carga

Guía de capas, reglas y convenciones del proyecto. **Mantener este contrato evita acoplamientos y simplifica los tests.**

> Última revisión: **v8.100.3 — 2026-05-02**
> Fuente espejo: `mem://technical/architecture-and-standards`.

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
11. [Testing](#11-testing)
12. [Decisiones explícitas (con fecha)](#12-decisiones-explícitas-con-fecha)
13. [Decisiones de no hacer](#13-decisiones-de-no-hacer)
14. [Glosario](#14-glosario)
15. [Versionado (SemVer)](#15-versionado-semver)

---

## 1. Estructura de carpetas

```text
src/
├── pages/          → Composición de UI por ruta. NO tocan Supabase ni lógica de dominio.
├── components/     → Componentes reutilizables y específicos de feature.
├── hooks/          → React Query + estado local + side effects (toasts, navegación).
│   ├── cotizacion/     → Hooks específicos del dominio de cotizaciones.
│   ├── embarque/       → Hooks específicos del dominio de embarques.
│   └── *.ts            → Hooks transversales (auth, permisos, dashboard, clientes, etc.).
├── services/       → Acceso puro a datos (Supabase, edge functions, fetch). Sin React Query.
├── lib/            → Utilidades puras y reutilizables.
│   ├── domain/         → Reglas de dominio (cálculos de estado, validaciones).
│   ├── mappers/        → Transformación entre formato DB ↔ UI.
│   ├── parsers/        → Parsing de payloads (CSF, dashboard).
│   └── *.ts            → formatters, errorUtils, queryKeys, etc.
├── content/        → Contenido editorial (changelog, copy de marketing).
├── constants/      → Constantes de dominio/UI (cotización, embarque, proveedor, wizard).
├── types/          → Tipos compartidos entre módulos.
├── contexts/       → React Contexts (Auth, Organization).
├── generators/     → Generación de archivos (PDF, CSV).
└── integrations/   → Clientes auto-generados (Supabase). NO editar.
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

Los consumidores externos importan siempre desde los barrels `@/hooks/useCotizaciones` y `@/hooks/useEmbarques`. Los archivos individuales bajo `hooks/cotizacion/` y `hooks/embarque/` son detalle de implementación — solo se importan directamente cuando exponen una API que no pasa por el barrel (ej. `useCotizacionWizardForm`, `useEmbarqueDetalleActions`).

En `src/services/` la convención (desde v8.86.0) es **folder + `index.ts`**:

- Cada dominio es una carpeta con `index.ts` que re-exporta sus submódulos.
  Ejemplo: `src/services/cliente/{index,crud,contactos,relacionados}.ts`.
- Naming sin sufijo: la carpeta se llama por el dominio en singular (`cliente`, `embarque`, `cotizacion`, `proforma`, `admin`). Nada de `xService.ts` o `xServices.ts` sueltos.
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
- **Componentes**: PascalCase descriptivo, prefijo de feature cuando ayuda. `EmbarqueWizard`, `ReportesKpiCards`, `DialogGenerarProforma`.
- **Services**: verbo en infinitivo. `fetchEmbarqueParaPdf`, `crearProforma`, `eliminarEmbarqueCascada`.
- **Archivos de tipos compartidos**: en `src/types/`, nombrados por dominio (`cotizacion.ts`, `cotizacionPL.ts`).

## 8. React Query — convenciones

- **Query keys**: centralizados en `src/lib/queryKeys.ts`. No usar arrays inline en hooks.
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
- **Policies** usan funciones `security definer` (`has_role`, `is_org_member`) para evitar recursión RLS.
- **Operaciones cross-org** (admin, super-admin) pasan por RPC `security definer` que validan rol antes de actuar.
- **Edge functions**: usan service-role key para acciones administrativas; la UI nunca recibe esa key.
- **Portal de clientes**: ver `mem://technical/security-patterns` para el patrón de escritura con rol read-only vía RPC.

## 11. Testing

- **Stack**: Vitest + Testing Library. 184 tests vigentes (v8.89.0).
- **Qué se testea**:
  - `src/lib/` (financial, domain, storage, ui, mappers complejos): puro, alta cobertura.
  - `src/services/` puros con lógica no trivial (csfService, trackingService).
  - Hooks con orquestación compleja (`useEmbarquesListData`, `useConfiguracionState`, `useAdminOrgDetalle`, `usePermissions`).
  - Funciones derivadas en constantes (`getDocsForMode`).
- **Qué NO se testea**:
  - Componentes shadcn ni wrappers triviales.
  - Pages (composición pura — se cubren vía tests de hooks/controller).
  - Mappers 1:1 sin lógica.
  - **Constantes literales y wrappers de terceros**: no testear arrays/objetos hardcodeados (es tautológico) ni funciones que sólo delegan a una librería externa (ej. `cn()` sobre `clsx + tailwind-merge`). Sí testear funciones que derivan/calculan a partir de la constante.
- **Ubicación**: carpeta `__tests__/` colocalizada junto al archivo bajo test. Convención de nombre: `<archivo>.test.ts`.
- **Comandos**: `bunx vitest run` (tests). `bunx tsc --noEmit` (type-check).


## 12. Decisiones explícitas (con fecha)

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
- **Sistema de diseño unificado — Apple-inspired** (v8.101.0). Componentes compartidos canónicos en `src/components/shared/` (`KpiCard`, `PageHeader`, `PageTabs`) y `src/components/ui/toggle-group.tsx` para segmented controls. Reglas:
  - Sidebar activo: `bg-sidebar-accent/10` + `font-semibold` (sin bloques sólidos de alto contraste).
  - Header sticky global: `z-40` + `bg-card/95` con `backdrop-blur` (evita clipping de contenido al hacer scroll).
  - Grids de cards: `auto-rows-fr` + `h-full` para garantizar simetría vertical.
  - Breadcrumbs: mostrar `…` mientras se resuelven segmentos UUID (no exponer IDs crudos).
  - Loading de rutas: skeletons layout-aware en `RouteLoadingFallback.tsx` (no spinners globales).
  - Light mode: logo y avatar sin contenedor blanco/ring.
  - Detalle de embarque: sin botón "back" redundante cuando hay breadcrumbs.

## 13. Decisiones de no hacer

Aceptadas explícitamente; no son deuda pendiente.

- **Hooks Detalle fragmentados**: `useCotizacionDetalleState` + `useCotizacionDetalleHandlers` y `useEmbarqueDetalleActions` + `useEmbarqueEstadoActions` + `useEmbarqueDocumentosActions` mantienen su separación queries/mutations a propósito. Fusionarlos perjudicaría testabilidad sin reducir complejidad real.
- **Naming bilingüe**: regla §7 cubre el patrón es/en. No se renombran archivos existentes para evitar ruido en historial.
- **Re-exports legacy `@/data/*`**: eliminados por completo en v8.36.0. No reintroducir.
- **`costosPLTypes.ts`**: se conserva (no se mueve a `src/types/`) porque exporta el helper UI `calcTotalsPL` usado por las secciones P&L. Cambiar de carpeta no aporta valor.

## 14. Glosario

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

## 15. Versionado (SemVer)

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
