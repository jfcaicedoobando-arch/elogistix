## Objetivo

Aplicar las 6 correcciones de navegación del sidebar (Etapa 1) descritas en `instrucciones-lovable-sidebar-etapa1-2026-07-25.md`. Cambios acotados a items/builders del sidebar + un hook/service nuevo para el badge de "Por pagar". Sin tocar router, páginas ni RLS.

Analogía: es como reordenar los letreros de un edificio — mismos cuartos, mejores señales.

## Cambios

**S1 · Eliminar `/cartera` duplicado**
- `sidebarItems.ts`: borrar `SIDEBAR_BANDEJAS_ITEMS` (:112-114) y el import `Wallet` si queda huérfano.
- `sidebarRoleBuilders.ts`: quitar import y sección "Bandejas" de `buildGerenteOperaciones`.

**S2a · Mover badge CxP a "Por aprobar"**
- `useAppSidebarSections.ts:37`: `/compras` → `/compras/por-aprobar`.

**S2b · Badge nuevo "Por pagar"**
- Nuevo service `src/features/cxp/services/fetchPorPagarCount.ts` (patrón `fetchPendientesAprobacionCount`, mismo origen/filtros que la bandeja `/compras/por-pagar`, `{ count: "exact", head: true }`).
- Nuevo hook `src/features/cxp/hooks/useCxpPorPagarCount.ts` con `staleTime: 60_000` y nueva queryKey `porPagarCount` en `src/lib/query`.
- `useAppSidebarSections.ts`: consumir hook y extender `BadgeCounts` + `patchSidebarBadges` con `cxpPorPagar` sobre `/compras/por-pagar`.
- Test vitest del service con supabase mockeado.

**S3 · Configuración → Sistema (rol contador)**
- `sidebarRoleBuilders.ts` `buildContador`: mover `SIDEBAR_ADMIN_ITEMS.filter(it => it.url === "/configuracion")` de "Facturación" a "Sistema".

**S4 · Renombres (sidebarItems.ts)**
- "Antigüedad A/R" → "Antigüedad CxC".
- "Antigüedad" (Compras) → "Antigüedad CxP".
- "Conciliación" (Compras) → "Conciliación CxP".

**S5 · Exponer "Por emitir"**
- `SIDEBAR_GESTION_ITEMS`: agregar tras "Facturación": `{ title: "Por emitir", url: "/proformas?estado=aceptada", icon: FileClock }`. Fallback a `Clock` si `FileClock` no existe en la versión de lucide.
- Añadir la URL a los `filterGestion([...])` de `buildCoordinador`, `buildContador`, `buildEjecutivoCobranza`, `buildAdmin`. `buildGerenteOperaciones` la recibe vía lista completa.

**S6 · Sentry fuera de menús operativos**
- `sidebarRoleBuilders.ts`:
  - `buildGerenteOperaciones`: cambiar `sistemaItems.filter(it => it.url !== "/auditoria")` por `filterSistema(sistemaItems, ["/ayuda", "/bitacora"])`.
  - `buildDefaultSections`: usar el mismo `filterSistema(...)`.
- `buildAdmin` y super_admin sin cambios.

## Verificación

- `bun run lint -- --max-warnings 0` limpio (ojo con imports huérfanos tras S1).
- `bunx vitest run` verde; actualizar tests de layout / smoke si enumeran "Bandejas" o etiquetas viejas.
- QA visual por rol: contador (Configuración en Sistema, Por emitir), tesorero (badges Por aprobar/Por pagar), gerente_operaciones (sin Bandejas ni Sentry ni duplicado /cartera), admin (renombres + Por emitir), coordinador (Por emitir).
- Deep link `/cxp` → `/compras/facturas` sigue funcionando (no se toca).

## Housekeeping

- Bump `APP_VERSION` → `13.317.8`.
- Entrada `CHANGELOG.md` describiendo los 6 fixes.

## Fuera de alcance

- No reordenar/renombrar secciones grandes, no fusionar secciones de 1 ítem, no tocar Compras estructural, no arreglar el doble active-state de S5 (aceptado por QA).