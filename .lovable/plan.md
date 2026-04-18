

# Análisis de Rendimiento — Libre Carga

Análisis de los principales cuellos de botella detectados en el código y la red. Sin cambios de código aún — solo diagnóstico y recomendaciones priorizadas.

---

## 1. Llamadas duplicadas de autenticación (CRÍTICO)

En `src/contexts/AuthContext.tsx`, al cargar la app se ven **6 peticiones casi idénticas** a Supabase en menos de 1 segundo (visible en network requests):

- `user_roles` se consulta **2 veces**
- `organization_members` se consulta **2 veces**
- Esto pasa porque `onAuthStateChange` y `getSession()` se disparan ambos al inicio, y además `OrganizationContext` vuelve a pedir lo mismo.

**Impacto:** ~500-800ms extra de latencia en cada carga inicial.

**Recomendación:** Deduplicar con un `useRef` que evite refetch si ya se obtuvo el rol en los últimos N ms, o consolidar en una sola llamada RPC `get_user_context()` que devuelva role + orgRole + organization en un solo round-trip.

---

## 2. Dashboard descarga TODOS los embarques sin paginar

`useEmbarques()` en `useEmbarqueQueries.ts` (usado por Dashboard y Operaciones) **trae todos los embarques** de la organización sin límite. Con 99 embarques activos hoy ya se nota; a 1000+ será insostenible.

Aunque `dashboard_stats()` RPC ya devuelve datos agregados, varios componentes (`useDashboardData`, `useOperacionesData`) siguen cargando el dataset completo en paralelo para cálculos client-side.

**Recomendación:**
- Mover toda la lógica de agregación al RPC `dashboard_stats` y `operaciones_stats` (server-side).
- Eliminar `useEmbarques()` del Dashboard. Solo usarlo donde sea estrictamente necesario.
- El cálculo de `desempeño por operador` (v8.13.2) debería ser un RPC nuevo, no procesarse en cliente.

---

## 3. Re-renders excesivos en tablas grandes

`DataTable` re-renderiza todas las filas cada vez que cambia `sortBy`, filtros, o se expande una fila (`Collapsible` en DesempenoOperadores).

**Componentes detectados sin memoización:**
- `EmbarquesActivosTable` (Dashboard)
- `ProfitTable`
- `DesempenoOperadores` — el `ClienteExpandible` re-monta al cambiar estado del padre
- Columnas de `clienteColumns.tsx` se recrean en cada render

**Recomendación:**
- Envolver definiciones de columnas en `useMemo`
- `React.memo` en sub-componentes de fila (`ClienteExpandible`, `EmbarqueCard`)
- Usar `useCallback` en handlers que se pasan como props a tablas

---

## 4. Búsqueda global sin debounce visible en el botón

`GlobalSearch.tsx` ya tiene debounce de 300ms ✅ pero la query RPC `busqueda_global` corre sobre múltiples tablas sin índice de texto. Con muchos registros se vuelve lenta.

**Recomendación:** Verificar índices `GIN` con `pg_trgm` en columnas `expediente`, `cliente_nombre`, `bl_master`, `nombre` (clientes/proveedores).

---

## 5. React Query — gcTime y staleTime no configurados consistentemente

Muchos hooks no definen `staleTime`, lo que causa refetch en cada montaje de componente. Ejemplos: `useExpedientesCliente`, `useEmbarqueConceptosVenta`, `useProveedoresForSelect`.

**Recomendación:**
- `staleTime: 30_000` para listas que no cambian segundo a segundo
- `staleTime: 5 * 60_000` para catálogos (puertos, navieras, tipos contenedor, proveedores)
- Configurar default global en `QueryClient` para evitar repetir en cada hook

---

## 6. Bundle inicial probablemente grande

No se ve `React.lazy()` en `App.tsx` para rutas pesadas como:
- `CotizacionDetalle`, `EditarCotizacion`, `NuevaCotizacion` (con PDF generation)
- `EmbarqueDetalle`, `EditarEmbarque`
- Páginas de `/admin/*`
- Portal cliente

**Recomendación:** Lazy-load rutas con `React.lazy` + `Suspense`. La librería `cotizacionPdf.ts` (probablemente jsPDF) debería cargarse solo cuando se exporte un PDF, no en el bundle inicial.

---

## 7. Logo SVG duplicado

`public/librecarga-logo.svg` y `src/assets/librecarga-logo.svg` — el de `public/` se sirve sin hash de cache, el de `assets/` se inlinea por Vite. Verificar que solo se use uno.

---

## 8. Realtime no parece usarse — bien ✅

No se detectó suscripción `supabase.channel()` activa global. Bueno para ahorrar conexiones, pero si se agrega, evitar suscribirse desde múltiples componentes a la misma tabla.

---

## 9. `setTimeout(..., 0)` en AuthContext

Los `setTimeout` para `fetchRole` y `registrarLogin` están bien para evitar deadlock con Supabase, pero **`registrarLogin` inserta en `bitacora_actividad` en cada login** sin batch. No es crítico, pero suma latencia perceptible al primer render.

**Recomendación:** Mover a edge function `fire-and-forget` o agruparlo con la consulta de rol.

---

## 10. Filtrado de estado en `useEmbarquesPaginados` es client-side

El comentario en `useEmbarqueQueries.ts` dice:
> "Estado filtering is done client-side because calcularEstadoEmbarque derives estado from ETD/ETA"

Esto significa que **se traen TODOS los registros de la página y luego se filtran en JS**, lo que rompe la paginación real cuando el filtro de estado está activo.

**Recomendación:** Crear una columna generada `estado_real` en la tabla `embarques` (o vista materializada) que ya tenga la lógica de ETD/ETA aplicada, e indexarla. Así el filtro vuelve al servidor.

---

## Prioridad sugerida

| # | Optimización | Impacto | Esfuerzo |
|---|--------------|---------|----------|
| 1 | Consolidar llamadas de auth/rol/org | Alto | Bajo |
| 2 | Mover agregaciones de Dashboard a RPC | Alto | Medio |
| 6 | Lazy-load rutas pesadas + jsPDF | Alto | Bajo |
| 5 | Configurar staleTime global | Medio | Bajo |
| 10 | Estado real en columna indexada | Medio | Medio |
| 3 | Memoizar columnas y filas de DataTable | Medio | Medio |
| 4 | Índices pg_trgm para búsqueda global | Medio | Bajo |
| 9 | Fire-and-forget bitácora de login | Bajo | Bajo |

---

## Próximo paso

Si quieres, puedo empezar implementando los puntos #1, #5 y #6 que son los de mayor impacto con menor riesgo. Confírmame cuáles atacar y arrancamos.

