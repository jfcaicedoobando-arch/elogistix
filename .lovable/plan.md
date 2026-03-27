

# Análisis de Rendimiento — Hallazgos y Recomendaciones

## Resumen

La app tiene buena base (lazy loading, query caching, column selection), pero hay un problema dominante que explica la lentitud percibida, más varios problemas secundarios.

---

## 1. CRÍTICO — `useEmbarques()` descarga TODOS los embarques en 3 páginas simultáneamente

El hook `useEmbarques()` (sin paginación) se invoca desde **3 consumidores independientes** cada vez que el usuario navega a cualquier ruta protegida:

- **`useSidebarAlerts`** — se monta en `AppSidebar` → `Layout`, activo en TODA la app
- **`useDashboardData`** — página Dashboard
- **`useOperacionesData`** — página Operaciones

Gracias a React Query comparten la misma caché, pero el problema es que `useSidebarAlerts` fuerza la descarga de TODOS los embarques en **cada navegación**, incluso cuando el usuario va a Clientes, Proveedores o Configuración. Con el límite de 1000 filas de Supabase, esto ya es un techo.

**Recomendación**: Reemplazar `useSidebarAlerts` con una query RPC ligera del tipo `SELECT count(*) FROM embarques WHERE estado = 'Arribo' AND eta < now() - interval '7 days'`. Esto elimina la descarga masiva del sidebar y la limita a Dashboard/Operaciones donde realmente se necesita.

**Impacto estimado**: Reducción de ~60-80% del tráfico de red en navegación general.

---

## 2. ALTO — Dashboard y Operaciones ejecutan 3 queries pesadas en paralelo

Al abrir Dashboard se disparan simultáneamente:
- `useEmbarques()` → todos los embarques
- `useProfitMaps()` → RPC `profit_por_embarque` (todos los embarques con conceptos)
- `useQuery(facturas)` → todas las facturas

Y en Operaciones los mismos 2 primeros. Todo este procesamiento (filtrado, agrupación, cálculo de profit) se hace client-side con `useMemo`.

**Recomendación a corto plazo**: Ya existe la nota de escalabilidad en el código. Crear una RPC `dashboard_stats()` que devuelva los conteos, alertas y profit agregados desde el servidor en una sola llamada. Esto reemplazaría las 3 queries + toda la lógica de `useMemo`.

**Recomendación a mediano plazo**: Crear `operaciones_stats()` RPC similar para la página Operaciones.

---

## 3. MODERADO — Queries N+1 en lista de Embarques

La página Embarques ejecuta 3 queries por cada carga de página:
1. `useEmbarquesPaginados` — los embarques paginados
2. `useEmbarquesLiquidacion(embarqueIds)` — conceptos_costo de todos los IDs visibles
3. `useEmbarquesDocsStatus(embarqueIds)` — documentos de todos los IDs visibles

Queries 2 y 3 dependen del resultado de query 1 (patrón waterfall). Además, descargan todas las filas de `conceptos_costo` y `documentos_embarque` solo para contar totales.

**Recomendación**: Crear una RPC `embarques_list_extras(p_ids uuid[])` que devuelva los conteos agregados en una sola llamada con `GROUP BY embarque_id`, eliminando el waterfall y reduciendo el payload.

---

## 4. MODERADO — `useEmbarquesLiquidacion` descarga filas completas para contar

La query actual hace `select('embarque_id, estado_liquidacion')` y luego cuenta en JS. Con muchos conceptos por embarque (ej. 20 embarques × 15 conceptos = 300 filas), esto es ineficiente.

**Recomendación**: Usar una query con `GROUP BY` del lado servidor:
```sql
SELECT embarque_id, count(*) as total, 
  count(*) FILTER (WHERE estado_liquidacion = 'Pagado') as pagados
FROM conceptos_costo WHERE embarque_id = ANY($1)
GROUP BY embarque_id
```

---

## 5. MENOR — `useUpdateConfiguracion` ejecuta updates secuenciales

El mutation de configuración hace un `for` loop con `await` por cada item, generando N requests secuenciales al guardar.

**Recomendación**: Agrupar en un solo `upsert` o crear una RPC que reciba el array completo.

---

## 6. MENOR — `AdminLayout` no usa lazy loading para su sidebar

`AdminLayout` importa `AdminSidebar` de forma síncrona. Menor impacto dado que solo afecta a super_admin.

**No requiere acción** por ahora.

---

## 7. MENOR — AuthContext hace doble fetch de sesión

En `AuthContext`, tanto `onAuthStateChange` como `getSession()` se ejecutan al montar, lo que puede resultar en `fetchRole` llamado dos veces al inicio. El `setTimeout` evita deadlocks pero agrega latencia.

**Recomendación**: Usar solo `onAuthStateChange` y eliminar el `getSession()` redundante, o guardar un flag para evitar el doble `fetchRole`.

---

## 8. COSMÉTICO — Hardcoded query key en `useSidebarAlerts`

La query de facturas vencidas usa `['sidebar-facturas-vencidas']` en lugar del factory `queryKeys`. Esto puede causar que no se invalide correctamente cuando se actualiza una factura.

**Recomendación**: Mover a `queryKeys.sidebar.facturasVencidas` o similar.

---

## Resumen Priorizado

| # | Prioridad | Acción | Impacto |
|---|-----------|--------|---------|
| 1 | Crítica | RPC ligera para sidebar alerts (eliminar `useEmbarques` del sidebar) | Elimina descarga masiva en toda la app |
| 2 | Alta | RPC `dashboard_stats` server-side | Reduce 3 queries + procesamiento client-side a 1 |
| 3 | Moderada | RPC `embarques_list_extras` para liquidación + docs | Elimina waterfall y reduce payload |
| 4 | Moderada | Agregar GROUP BY server-side para conteos | Reduce filas transferidas |
| 5 | Menor | Batch upsert en configuración | Reduce N requests a 1 |
| 6 | Menor | Deduplicar fetchRole en AuthContext | Elimina request redundante al inicio |
| 7 | Menor | Migrar query key hardcoded del sidebar | Correctitud de cache invalidation |

## Lo que ya está bien optimizado

- Lazy loading por ruta con `React.lazy`
- `staleTime: 30s` y `gcTime: 5<lov-plan>

# Análisis de Rendimiento — Hallazgos y Recomendaciones

## Resumen

La app tiene buena base (lazy loading, query caching, column selection), pero hay un problema dominante que explica la lentitud percibida, más varios problemas secundarios.

---

## 1. CRÍTICO — `useEmbarques()` descarga TODOS los embarques en 3 páginas simultáneamente

El hook `useEmbarques()` (sin paginación) se invoca desde **3 consumidores independientes** cada vez que el usuario navega a cualquier ruta protegida:

- **`useSidebarAlerts`** — se monta en `AppSidebar` → `Layout`, activo en TODA la app
- **`useDashboardData`** — página Dashboard
- **`useOperacionesData`** — página Operaciones

Gracias a React Query comparten la misma caché, pero el problema es que `useSidebarAlerts` fuerza la descarga de TODOS los embarques en **cada navegación**, incluso cuando el usuario va a Clientes, Proveedores o Configuración. Con el límite de 1000 filas de Supabase, esto ya es un techo.

**Recomendación**: Reemplazar `useSidebarAlerts` con una query RPC ligera del tipo `SELECT count(*) FROM embarques WHERE estado = 'Arribo' AND eta < now() - interval '7 days'`. Esto elimina la descarga masiva del sidebar y la limita a Dashboard/Operaciones donde realmente se necesita.

**Impacto estimado**: Reducción de ~60-80% del tráfico de red en navegación general.

---

## 2. ALTO — Dashboard y Operaciones ejecutan 3 queries pesadas en paralelo

Al abrir Dashboard se disparan simultáneamente:
- `useEmbarques()` → todos los embarques
- `useProfitMaps()` → RPC `profit_por_embarque` (todos los embarques con conceptos)
- `useQuery(facturas)` → todas las facturas

Y en Operaciones los mismos 2 primeros. Todo este procesamiento (filtrado, agrupación, cálculo de profit) se hace client-side con `useMemo`.

**Recomendación a corto plazo**: Ya existe la nota de escalabilidad en el código. Crear una RPC `dashboard_stats()` que devuelva los conteos, alertas y profit agregados desde el servidor en una sola llamada. Esto reemplazaría las 3 queries + toda la lógica de `useMemo`.

**Recomendación a mediano plazo**: Crear `operaciones_stats()` RPC similar para la página Operaciones.

---

## 3. MODERADO — Queries N+1 en lista de Embarques

La página Embarques ejecuta 3 queries por cada carga de página:
1. `useEmbarquesPaginados` — los embarques paginados
2. `useEmbarquesLiquidacion(embarqueIds)` — conceptos_costo de todos los IDs visibles
3. `useEmbarquesDocsStatus(embarqueIds)` — documentos de todos los IDs visibles

Queries 2 y 3 dependen del resultado de query 1 (patrón waterfall). Además, descargan todas las filas de `conceptos_costo` y `documentos_embarque` solo para contar totales.

**Recomendación**: Crear una RPC `embarques_list_extras(p_ids uuid[])` que devuelva los conteos agregados en una sola llamada con `GROUP BY embarque_id`, eliminando el waterfall y reduciendo el payload.

---

## 4. MODERADO — `useEmbarquesLiquidacion` descarga filas completas para contar

La query actual hace `select('embarque_id, estado_liquidacion')` y luego cuenta en JS. Con muchos conceptos por embarque (ej. 20 embarques × 15 conceptos = 300 filas), esto es ineficiente.

**Recomendación**: Usar una query con `GROUP BY` del lado servidor:
```sql
SELECT embarque_id, count(*) as total, 
  count(*) FILTER (WHERE estado_liquidacion = 'Pagado') as pagados
FROM conceptos_costo WHERE embarque_id = ANY($1)
GROUP BY embarque_id
```

---

## 5. MENOR — `useUpdateConfiguracion` ejecuta updates secuenciales

El mutation de configuración hace un `for` loop con `await` por cada item, generando N requests secuenciales al guardar.

**Recomendación**: Agrupar en un solo `upsert` o crear una RPC que reciba el array completo.

---

## 6. MENOR — AuthContext hace doble fetch de sesión

En `AuthContext`, tanto `onAuthStateChange` como `getSession()` se ejecutan al montar, lo que puede resultar en `fetchRole` llamado dos veces al inicio. El `setTimeout` evita deadlocks pero agrega latencia.

**Recomendación**: Usar solo `onAuthStateChange` y eliminar el `getSession()` redundante, o guardar un flag para evitar el doble `fetchRole`.

---

## 7. COSMÉTICO — Hardcoded query key en `useSidebarAlerts`

La query de facturas vencidas usa `['sidebar-facturas-vencidas']` en lugar del factory `queryKeys`. Esto puede causar que no se invalide correctamente cuando se actualiza una factura.

**Recomendación**: Mover a `queryKeys.sidebar.facturasVencidas` o similar.

---

## Resumen Priorizado

| # | Prioridad | Acción | Impacto |
|---|-----------|--------|---------|
| 1 | Crítica | RPC ligera para sidebar alerts (eliminar `useEmbarques` del sidebar) | Elimina descarga masiva en toda la app |
| 2 | Alta | RPC `dashboard_stats` server-side | Reduce 3 queries + procesamiento client-side a 1 |
| 3 | Moderada | RPC `embarques_list_extras` para liquidación + docs | Elimina waterfall y reduce payload |
| 4 | Moderada | Agregar GROUP BY server-side para conteos | Reduce filas transferidas |
| 5 | Menor | Batch upsert en configuración | Reduce N requests a 1 |
| 6 | Menor | Deduplicar fetchRole en AuthContext | Elimina request redundante al inicio |
| 7 | Menor | Migrar query key hardcoded del sidebar | Correctitud de cache invalidation |

## Lo que ya está bien optimizado

- Lazy loading por ruta con `React.lazy` y `Suspense`
- `staleTime: 30s` y `gcTime: 5min` globales en React Query
- Column selection explícita (`EMBARQUE_LIST_COLUMNS`, `CLIENTE_LIST_COLUMNS`, etc.)
- Paginación server-side en Embarques, Clientes y Cotizaciones
- `useProfitMaps` usa RPC `profit_por_embarque` (agregación server-side)
- `placeholderData` para transiciones suaves entre páginas
- `useDebounce` en búsquedas para evitar queries excesivas
- Operaciones atómicas vía RPCs (`crear_embarque_completo`, `actualizar_embarque_completo`)

