

## Análisis de rendimiento — v8.22.0

Voy a revisar archivos clave para tener evidencia concreta antes de presentar el plan.
<lov-tool-use id="toolu_vrtx_01Lnw4p74btPesmqkqvuMzSL" name="code--view" integration-id="code" data="{\"file_path\": \"src/App.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_019qNoCjaAocEVBzZdWp8xVn" name="code--view" integration-id="code" data="{\"file_path\": \"src/contexts/AuthContext.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01KS2i9G4onXBTqq1gAzjnhS" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/dashboard/EmbarquesActivosTable.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01P4Z6dZ7yAaXVUAWGS6SiGF" name="code--view" integration-id="code" data="{\"file_path\": \"src/hooks/useSidebarAlerts.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_018sCFT5p9DNoMY3a2BBJLgD" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/DataTable.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01YUG3wqy8BF1dwJfbWjjPB8" name="code--view" integration-id="code" data="{\"file_path\": \"src/App.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_016MzeP9dPcmXAt7SYpzg48H" name="code--view" integration-id="code" data="{\"file_path\": \"src/contexts/AuthContext.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_011LzE5799WGMyVNN1rnsTqs" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/dashboard/EmbarquesActivosTable.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0128ntzLYjKvGy1BCDXSbpKw" name="code--view" integration-id="code" data="{\"file_path\": \"src/hooks/useSidebarAlerts.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01NaWoEyLQDW8sqyZXFYArE2" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/DataTable.tsx\"}">
</lov-tool-use>
The console error reveals a real bug: `memo(DataTableInner)` strips generics and React fires "Function components cannot be given refs". More importantly I see the `get_user_context` RPC fires every ~60s and the dashboard re-fetches with it. Let me check a few more high-value areas.
<lov-tool-use id="toolu_vrtx_017ozBjq2outxzNkpfgMH7yf" name="code--exec" integration-id="code" data="{\"command\": \"cd /dev-server && wc -l src/pages/*.tsx | sort -rn | head -20 && echo \\\"---HOOKS---\\\" && wc -l src/hooks/*.ts | sort -rn | head -15\", \"user_facing_description\": \"Identifying largest pages and hooks\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01TPeAQA9nNtYEfnswuBeRgT" name="code--search_files" integration-id="code" data="{\"query\": \"useQuery|useEffect\", \"include_patterns\": \"src/pages/Dashboard.tsx,src/pages/Embarques.tsx,src/pages/portal/PortalDashboard.tsx,src/components/Layout.tsx,src/components/AppSidebar.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01L5kCUGiCL7ZYu7CuX6yx5A" name="code--exec" integration-id="code" data="{\"command\": \"cd /dev-server && grep -rn \\\"useQuery\\\\|onAuthStateChange\\\\|get_user_context\\\" src/pages/Dashboard.tsx src/pages/portal/PortalDashboard.tsx src/components/Layout.tsx src/components/AppSidebar.tsx src/contexts/OrganizationContext.tsx 2>/dev/null | head -40\", \"user_facing_description\": \"Searching for query and auth patterns in key files\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01NkJqrzJ4X7vp4rsp3cQ8oh" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/Dashboard.tsx\"}">
</lov-tool-use>
The network logs show `get_user_context` and `dashboard_stats` firing every ~60s. Let me check what's triggering this — probably window focus refetch, but `refetchOnWindowFocus: false` is set. The auth `onAuthStateChange` `TOKEN_REFRESHED` event would re-trigger `fetchUserContext` (TTL is 60s). Also the bitacora insert fires on every refresh because `hasLoggedLogin.current` resets on remount. Let me confirm and check Layout/manualChunks.
<lov-tool-use id="toolu_vrtx_01FM2Ue1yuhFnTnmo8ocBK29" name="code--exec" integration-id="code" data="{\"command\": \"cd /dev-server && cat src/components/Layout.tsx 2>/dev/null | head -80 && echo \\\"---SIDEBAR---\\\" && wc -l src/components/AppSidebar.tsx && grep -n \\\"useQuery\\\\|useEffect\\\\|useMemo\\\" src/components/AppSidebar.tsx | head -20\", \"user_facing_description\": \"Inspecting layout and sidebar\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_018DNiv6xM7x3KGb2FBN9G9M" name="code--exec" integration-id="code" data="{\"command\": \"cd /dev-server && grep -rn \\\"select(\\\\\\\"\\\\*\\\\\\\")\\\\|select('\\\\*')\\\" src/hooks src/services 2>/dev/null | head -20\", \"user_facing_description\": \"Finding select * queries\"}">
</lov-tool-use>
I have enough. The network log clearly shows `get_user_context` + `dashboard_stats` + `sidebar_alert_counts` + `bitacora_actividad` insert firing every ~60s (3 cycles visible). That's a strong signal — likely Supabase token refresh triggering `onAuthStateChange` → `fetchUserContext` (cache hits, OK) but ALSO `SIGNED_IN` event re-triggering bitacora insert (since `hasLoggedLogin` ref is fine, but maybe TOKEN_REFRESHED is treated as SIGNED_IN). The auth context refetches and React Query is also somehow refetching dashboard. Let me present the audit.

<lov-plan>

# Análisis de rendimiento (read-only, sin cambios)

## Hallazgos críticos detectados

### 🔴 1. Re-fetch innecesario cada ~60 segundos (visible en logs de red)
Los logs muestran este patrón repitiéndose cada ~60–66 segundos:
```
get_user_context → bitacora_actividad (insert) → sidebar_alert_counts → dashboard_stats
```
**Causa probable**: Supabase emite `TOKEN_REFRESHED` cada minuto. En `AuthContext.tsx` línea 113-132, **cualquier evento** dispara `setSession`, `setUser` y `fetchUserContext`. Aunque `fetchUserContext` tiene cache TTL de 60s (justo igual al refresh), el `setSession`/`setUser` re-renderiza todo el árbol bajo `AuthProvider` → React Query revalida queries que dependen del usuario → **se invalidan dashboard, sidebar, etc.**

Adicionalmente, la condición `_eventoAuth === 'SIGNED_IN'` se cumple en cada token refresh en algunos casos, disparando inserts a `bitacora_actividad` (visibles en logs a las 21:30:22, 21:31:28, 21:32:32 — uno por minuto).

**Impacto**: 4 round-trips/min al backend para cada usuario logueado, pantallas que parpadean o "se sienten lentas" en cada minuto.

---

### 🔴 2. Bug de React: `Function components cannot be given refs` en `DataTable`
Console log:
```
Warning: Function components cannot be given refs.
Check the render method of `DataTableInner`.
at Badge → td → DataTableInner
```
**Causa**: `DataTable.tsx` línea 176 envuelve un componente genérico con `memo()` y al renderizar `<Badge>` con `asChild`/refs internos del Radix Slot, React falla. Esto **rompe `memo` silenciosamente** y obliga a re-render completo de la tabla en cada cambio.

---

### 🟡 3. `dashboard_stats` devuelve payload muy grande (>30KB)
Ese RPC retorna en una sola llamada: `alertasDemora` (15+ items con todos los campos), `proximosArribos`, `profitArribosEsteMes`, `embarquesMesSiguiente`, `cargasPorCliente`, `arribosEsteMes`, `conteoPorEstado`, `resumenMesSiguiente`. Todo se transmite aunque el usuario solo vea una sección.

**Impacto**: Carga de dashboard pesada en cada refetch (~30–80KB JSON parseado en main thread).

---

### 🟡 4. 22 hooks usan `select('*')`
Encontré 22 lugares (`useAdminData`, `useClientes`, `useEmbarqueQueries`, `useCotizacionQueries`, etc.) que traen TODAS las columnas. Para tablas con muchas columnas JSONB (conceptos, costos, documentos), esto multiplica el payload por 3–10x.

---

### 🟡 5. Doble contexto org con cache + auto-fetch
`AuthContext` ya cachea `organization`. `OrganizationContext` lo re-deriva con `useMemo`, y para super-admin lanza otra query a `organizations`. Para usuarios regulares no hay duplicación, pero el patrón invita a inconsistencias.

---

### 🟢 6. Bundle / lazy loading
**Bien**: `App.tsx` ya lazy-loadea todas las páginas. `vite.config.ts` ya hace manualChunks (react/query/charts/radix). Sin acción urgente aquí.

### 🟢 7. Imágenes / assets
Solo hay `librecarga-logo.svg` y `placeholder.svg`. No hay deuda visible.

---

## Componentes con riesgo de re-render frecuente

| Componente | Síntoma | Causa |
|---|---|---|
| `DataTable` (todos los listados) | Re-render completo cada actualización del padre | `memo()` roto por warning de refs (#2) |
| `Dashboard.tsx` | Refresca cada 60s | Trigger en cadena de #1 |
| `AppSidebar` | Re-render con cada `setSession` | Consume `useAuth` → cualquier cambio invalida |
| `EmbarquesActivosTable` columns | Definidas a nivel módulo (✅ bien) | — |

---

## 📋 Recomendaciones priorizadas

### 🔥 Críticas (atacar primero)
1. **Filtrar `TOKEN_REFRESHED` en `AuthContext`**: solo procesar `SIGNED_IN`, `SIGNED_OUT`, `USER_UPDATED`. Ignorar `TOKEN_REFRESHED` y `INITIAL_SESSION` después de la primera carga. Esto elimina el ciclo de 60s.
2. **Mover registro de bitácora a un único `SIGNED_IN` real** (con guard por sessionStorage para evitar re-loguear en cada refresh de pestaña).
3. **Arreglar el warning de refs en `DataTable`**: o quitar `memo()` (es un genérico, casi no aporta), o envolver `DataTableInner` con `forwardRef` y propagar correctamente. Sospecho que `<Badge>` con un className que activa Slot está recibiendo un ref desde una row con `onClick`.

### ⚡ Alto impacto
4. **Partir `dashboard_stats` en 2–3 RPCs** o agregar parámetro `sections[]` para que el cliente pida solo lo que va a mostrar.
5. **Aumentar `staleTime` selectivo**: `dashboard.stats` puede ser 2–5 min; `sidebar.alertCounts` puede ser 5 min. Hoy todo usa 30s default.
6. **Reemplazar los 22 `select('*')`** por columnas explícitas (ya existen constantes `EMBARQUE_LIST_COLUMNS` y `COTIZACION_LIST_COLUMNS` — replicar el patrón).

### 🛠️ Medio impacto
7. **`useMemo` para fechas calculadas** en `Dashboard.tsx` (`hoyStr`, `getSaludo`) — hoy se recomputan en cada render.
8. **`React.memo` en cards del dashboard** (`AlertasDemoraCard`, `ProximosArribosCard`, `CargasActivasClienteCard`) con props estables — hoy se re-renderizan junto al padre.
9. **Eliminar `OrganizationContext` para usuarios regulares**: ya viene cacheado en `AuthContext`. Mantenerlo solo como capa para super-admin (opcional).
10. **Agregar `keepPreviousData: true`** en queries paginadas (`useEmbarques`, `useClientes`) para evitar skeletons en cambios de página.

### 🎨 Polish
11. **Prefetch en hover** de filas (`onMouseEnter` → `queryClient.prefetchQuery`) para detalle de embarque/cotización — la navegación se sentirá instantánea.
12. **Debounce visible**: confirmar que `SearchInput` ya usa `useDebounce` en todas las páginas (actualmente solo en algunas).
13. **`bundle-analyzer`** una vez para confirmar tamaño real de chunks (hoy es deduce, no medido).

---

## Plan de ejecución sugerido (orden estricto)

| # | Acción | Esfuerzo | Ganancia esperada |
|---|--------|----------|-------------------|
| 1 | Filtrar `TOKEN_REFRESHED` en AuthContext + guard de bitácora | XS | **Elimina 4 round-trips/min** |
| 2 | Arreglar warning de refs en `DataTable` (`memo` o `forwardRef`) | S | Re-renders 30–60% menos en listas |
| 3 | Subir `staleTime` de `dashboard.stats` y `sidebar.alertCounts` a 2–5 min | XS | Refetches en background mucho menos frecuentes |
| 4 | Reemplazar `select('*')` por columnas explícitas (top 5 más usados) | M | Payload 50–80% menor |
| 5 | Partir `dashboard_stats` en RPCs por sección (lazy bajo demanda) | M | TTFB del dashboard 2–3x más rápido |
| 6 | `React.memo` en cards de dashboard + `useMemo` en fechas | XS | Re-renders parásitos |
| 7 | `keepPreviousData` en listados paginados | XS | UX percibida más fluida |
| 8 | Prefetch en hover de filas | S | Navegación a detalle "instantánea" |
| 9 | Consolidar `OrganizationContext` para usuarios regulares | S | Menos re-renders y menos código |
| 10 | Auditar bundle real con `rollup-plugin-visualizer` | XS | Confirma o descarta deuda de assets |

**Recomendación**: ejecutar #1, #2 y #3 como primer ciclo — es donde está el dolor real de "sluggish" reportado. #4 y #5 después para reducir carga sostenida.

