> ⚠️ **OBSOLETO** — El canónico de arquitectura es [`ARCHITECTURE.md`](../ARCHITECTURE.md). Este documento se conserva por contexto histórico; la topología real ya no coincide con lo descrito aquí (la estructura vive en `src/features/<dominio>/`, no en `src/pages` + `src/hooks/<dominio>`).

# Architecture Map — Libre Carga

Documento vivo. Tabla de dominio → pages → hooks → services → lib para los
dominios principales. Sirve para onboarding y como ancla del roadmap
arquitectónico.

Jerarquía obligatoria (enforz. por `eslint.config.js`):

```
Pages / Components
        ↓
      Hooks
        ↓
     Services  (única capa con acceso Supabase)
        ↓
       Lib  (puro, sin React, sin Supabase)
```

Regla clave: ningún archivo bajo `lib/` o `services/` puede importar
de `hooks/`, `components/`, `pages/` o `contexts/`.

## Tabla por dominio

| Dominio | Pages | Hooks | Services | Lib |
|---|---|---|---|---|
| Embarques | `pages/embarques/*`, `pages/embarque/*` | `hooks/embarque/*` | `services/embarque/{queries,mutations,documentos,tracking}` | `lib/mappers/{embarqueFromDb,embarqueToDb}`, `lib/domain/embarque` |
| Cotizaciones | `pages/cotizaciones/*`, `pages/dev/PdfPreviewCotizacion` | `hooks/cotizacion/*` | `services/cotizacion/{queries,mutations,costos}` | `lib/mappers/{cotizacion,cotizacionForm,embarqueCotizacion}`, `pdf/documents/CotizacionDocument` |
| Clientes | `pages/clientes/*`, `pages/cliente/*` | `hooks/cliente/*` | `services/cliente/*` | `lib/domain/cliente`, `lib/formatters` |
| Facturación | `pages/facturacion/*` | `hooks/facturacion/*` | `services/facturas/{queries,proyeccion,huecoFacturacion}`, `services/proforma/*` | `lib/financialUtils`, `lib/domain/facturas` |
| CRM (Leads/Oportunidades) | `pages/crm/*` | `hooks/crm/*` | `services/crm/*` | `lib/domain/crm` |
| Portal cliente | `pages/portal/*`, `components/portal/*` | `hooks/portal/*` | `services/portal/*` (RPCs SECURITY DEFINER) | `lib/domain/portal` |
| Auditoría / Bitácora | `pages/admin/Auditoria*`, `pages/admin/Bitacora` | `hooks/auditoria/*`, `hooks/shared/useBitacora` | `services/auditoria/*`, `services/observability/*` | `lib/domain/auditoria` (con tests) |
| Admin (orgs, usuarios) | `pages/admin/*`, `pages/admin-org/*` | `hooks/admin/*` | `services/admin/*` + edge functions (`list-users`, `create-user`, `delete-user`, `invite-client-user`) | `lib/domain/admin` |
| Proveedores | `pages/proveedores/*` | `hooks/proveedor/*` | `services/proveedor/*` | `lib/formatters/phone` |
| Catálogos (puertos, navieras, IVA) | n/a (selects) | `hooks/catalogos/*` | `services/catalogos/*` | `lib/domain/catalogos` |
| Configuración | `pages/Configuracion`, `pages/admin/AdminConfiguracion` | `hooks/configuracion/*` | `services/configuracion/*` | — |
| Operaciones / Dashboard | `pages/dashboard/*`, `pages/dashboard/Operaciones` | `hooks/operaciones/*`, `hooks/dashboard/*` | `services/operaciones/*` | `lib/domain/operaciones` |
| Reportes / Analítica | `pages/dashboard/Reportes`, `pages/admin/DesempenoOperadores` | `hooks/reportes/*` | `services/reportes/*` | `lib/financialUtils`, `lib/domain/reportes` |

## Hooks compartidos (`hooks/shared/`)

Barrel único: `@/hooks/shared` re-exporta todos. **No** importar
archivos internos (`@/hooks/shared/useToast` está restringido por
`no-restricted-imports`).

- `useToast`, `toast` — sistema de toasts (shadcn).
- `useIsMobile` — breakpoint mobile <768px.
- `useDebounce` — debounce reusable.
- `useBitacora` — registro de actividad.
- `useGlobalSearch` — atajo Ctrl+K.
- `useListPageState` — estado de tablas paginadas server-side.
- `useOrgFilter` — filtro por org en queries.
- `usePermissions` — chequeo de roles efectivos.
- `useSidebarAlerts` — badges del sidebar.
- `useTabsParam` — sync tab activa ↔ URL.

## Convenciones invariables

- **Imports**: siempre desde el barrel del dominio (`@/hooks/<x>`,
  `@/services/<x>`). Archivos internos restringidos como `error`.
- **Supabase**: sólo en `services/` y `integrations/supabase`. **0
  llamadas directas** desde hooks, contexts, components o pages al
  11.60.0 (Bloque A cerrado en 11.59.1).
- **Query keys**: factory partido por dominio en `src/lib/query/keys/*.ts`
  (14 archivos ≤66 líneas). Importar siempre vía `@/lib/query` →
  `queryKeys.<dominio>.*`. Bloque B4 cerrado en 11.60.0.
- **Tests**: `*.test.ts(x)` co-localizados o en `__tests__/`. 18
  suites en `services/` (meta ≥10), 111 totales / 728 tests.
- **Versionado**: bump `APP_VERSION` + entrada en `CHANGELOG.md`
  raíz en cada cambio. No existe ruta `/changelog` ni
  `src/content/changelog/`.
- **Cleanup en effects**: todo `useEffect` con canales Supabase /
  listeners / timers debe retornar cleanup. Power of 10.
- **Componentes ≤200 líneas**, sin `any`, paginación en listas,
  manejar `error` de Supabase. Power of 10 (mem://principles/power-of-10).

## Bundle / lazy loading (etapa 5)

Chunks lazy (no entran al primer load):
- `pdf-vendor` (475 KB) — `@react-pdf/renderer` + transitivas.
- `sentry-vendor` (151 KB) — init en `requestIdleCallback`.
- `charts-vendor` (92 KB) — `recharts` vía `React.lazy` + Suspense.
- `phone-vendor` (29 KB) — `libphonenumber-js` aislado.
- `query-persist-vendor` — persister de React Query.

`build.modulePreload.resolveDependencies` en `vite.config.ts`
filtra estos chunks del `<link rel="modulepreload">` del entry
(ahorro ~700 KB en /login).
