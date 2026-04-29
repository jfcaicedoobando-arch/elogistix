
# Auditoría de Performance — Estado Actual (post v8.99.43)

Métricas reales capturadas del preview en vivo (viewport 675×578, dashboard `/`):

```text
First Contentful Paint   8,592 ms   ← objetivo <1,800 ms
DOM Content Loaded       8,516 ms
Full Page Load           8,608 ms
Scripts cargados         99 archivos / 942 KB
Script más pesado        lucide-react.js — 157 KB / 1,671 ms
Heap usado               16 MB
DOM nodes                231 (sano)
```

**Diagnóstico:** las optimizaciones de DB de la oleada anterior funcionaron (los RPCs responden bien), pero el cuello de botella se movió al **arranque del front**: bundle, iconos y waterfalls de import.

---

## Hallazgos nuevos (no abordados antes)

### A. Bundle inicial — crítico
1. **`lucide-react` (157 KB, 1.67 s)** se importa como barrel en muchos archivos (`AppSidebar` solo usa 17 iconos pero arrastra el bundle completo en dev). El plugin SWC ya hace tree-shaking en build, pero en dev y en chunks compartidos termina duplicado.
2. **`AppSidebar` importa `chunk0` del changelog (66 KB)** únicamente para leer `APP_VERSION`. Ese chunk contiene textos largos de release notes y se carga en TODA sesión autenticada, no solo en `/changelog`.
3. **99 scripts en la primera carga** sugiere fragmentación excesiva de Vite. Falta agrupar `lucide-react`, `date-fns`, `cmdk`, `sonner` en un `ui-vendor` chunk dedicado.

### B. Render del shell autenticado
4. **`AppSidebar` no está memoizado** y se re-renderea en cada cambio de ruta (porque `useLocation()` cambia). Sus 6 `renderGroup(...)` se reconstruyen completos en cada navegación, generando ~50 nodos x 6 grupos.
5. Los arrays `dashboardItems`, `gestionItems`, etc., están en módulo (bien), pero `renderGroup` se recrea como closure inline en cada render → ningún `React.memo` interno funcionaría.
6. **`useSidebarAlerts` se invoca en cada render del sidebar** sin compartir cache entre tabs/instancias; verificar `staleTime`.

### C. Waterfalls de auth
7. Secuencia observada en login: `refresh_token` → `get_user_context` → `sidebar_alert_counts` → `dashboard_summary` + `dashboard_details`. Las dos primeras son **secuenciales obligadas**, pero `sidebar_alert_counts` podría dispararse en paralelo con `dashboard_summary` (hoy espera al perfil).
8. **`AuthContext` hace `idle preload` de 3 rutas** después del login (Embarques, Cotizaciones, Dashboard). Bien, pero falta agregar `Clientes` y `Proveedores` que también son navegación frecuente.

### D. Detalles ya optimizados (verificación OK)
- Counts `estimated` aplicados ✅
- RPC `get_embarque_full` consolidando 6 calls ✅
- `preconnect` a Supabase en `index.html` ✅
- `useDashboardData` paraleliza summary/details ✅
- `radix-vendor` chunk expandido ✅

---

## Plan de optimizaciones — Oleada E (Bundle & Shell)

### E1. Aligerar AppSidebar (alto impacto, bajo riesgo)
- Crear `src/constants/appVersion.ts` que exporte `APP_VERSION` como string literal (actualizado por el mismo script que mantiene el changelog), eliminando el import de `chunk0` del sidebar.
- Envolver `AppSidebar` con `React.memo` (no recibe props).
- Extraer `renderGroup` a un sub-componente `<SidebarGroupBlock>` también memoizado, recibiendo `items`, `label`, `collapsed`, `pathname`, `totalAlertas`.
- **Ahorro estimado:** −66 KB en initial load + evita re-render de 6 grupos por navegación.

### E2. Optimizar `manualChunks` en `vite.config.ts`
- Agregar agrupaciones:
  - `icons-vendor` → `lucide-react`
  - `forms-vendor` → `react-hook-form`, `@hookform/resolvers`, `zod`
  - `utils-vendor` → `date-fns`, `clsx`, `tailwind-merge`, `class-variance-authority`
  - `ui-vendor` → `cmdk`, `sonner`, `next-themes`
- Esto consolida ~20 chunks pequeños en 4 más cacheables y mejora HTTP/2 priority.

### E3. Lazy-load del changelog completo
- `Changelog.tsx` ya carga via `React.lazy` (verificar). Confirmar que `chunk0..chunk5` se cargan dinámicamente sólo en esa ruta y no via barrels desde `changelogData.ts`.

---

## Plan — Oleada F (Render & Auth)

### F1. Disparar alerts en paralelo con auth
- En `useSidebarAlerts`, no esperar a `effectiveRole`; lanzar el RPC apenas haya `user.id` (la RLS valida org). Reduce TTI de la primera pantalla en ~150-300 ms.
- Subir `staleTime` de alerts a 60s (hoy probablemente 0).

### F2. Preload extendido
- En `AuthContext`, agregar al `idle preload`:
  - `@/pages/clientes/Clientes`
  - `@/pages/proveedores/Proveedores`
  - `@/pages/facturacion/Facturacion`

### F3. Memoizar consumidores frecuentes
- `Breadcrumbs` y `OrgSwitcher` con `React.memo`.
- `useAuth()` ya retorna objeto memoizado ✅.

---

## Plan — Oleada G (Lecturas frías de catálogos)

### G1. Persistir cache de catálogos
- Ports, navieras, tipos de contenedor, tasa IVA tienen `staleTime: 30 min` ✅, pero se pierden al refrescar. Implementar `persistQueryClient` de TanStack Query con `localStorage`, limitado a las queries de catálogo (`queryKey[0] === 'catalogos'`).
- TTI de un refresco caería ~200-400 ms en pantallas que dependen de selects.

### G2. Indices DB faltantes (verificar via migration)
- Confirmar índices en `embarques(organization_id, eta)`, `embarques(organization_id, estado, eta)` y `facturas(organization_id, fecha_vencimiento)` que sirven a `sidebar_alert_counts` y `dashboard_details`.

---

## Métricas objetivo tras todas las oleadas

| Métrica | Hoy | Objetivo |
|---|---|---|
| FCP | 8.5 s | <2.5 s |
| DCL | 8.5 s | <3 s |
| Scripts iniciales | 99 | <60 |
| Bundle vendor inicial | 942 KB | <650 KB |
| Sidebar re-renders/navegación | 1 completo | 0 (memoizado) |

---

## Orden propuesto

1. **Oleada E** (bundle + sidebar) — máximo impacto visible
2. **Oleada F** (render + auth) — pulido de TTI
3. **Oleada G** (cache persistente + índices) — refrescos rápidos

Cada oleada termina con entrada en `Changelog.tsx` (v8.99.44, .45, .46).

¿Apruebas ejecutar las 3 oleadas en secuencia, o prefieres validar después de la E antes de continuar?
