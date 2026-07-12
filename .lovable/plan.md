# Auditoría TanStack — Libre Carga

## Diagnóstico corto

**Versiones (todas ~3 patches atrás del último release, ninguna con APIs rotas):**

- `@tanstack/react-query` **5.101.2** → último 5.104+
- `@tanstack/react-table` **8.21.3** → al día
- `@tanstack/react-virtual` **3.14.5** → al día
- `query-sync-storage-persister` + `react-query-persist-client` **5.101.2**

**Veredicto:** implementación **sólida y por encima del promedio**, pero **no "top of the line" todavía**. Fortalezas claras: `QueryClient` centralizado con Sentry, persistencia inteligente por whitelist, `DataTable`/`VirtualDataTable` compartidos, migración v5 correcta (`placeholderData: keepPreviousData`), 0 anti-patrones removidos en v5. Debilidades: 181 query keys inline fuera de las factories, 0 uso del helper moderno `queryOptions()`, 0 devtools, `useMutation` optimista casi inexistente, y features `bandejas` + `compras` sin `queryKeys.ts`.

---

## Fase 1 · Higiene inmediata (baja fricción, gran retorno)

1. **Bump TanStack a último patch**
  - RQ `5.101.2` → `5.104.x`, persister igual. Sin breaking changes esperados.
2. **Devtools sólo en dev**
  - `bun add -D @tanstack/react-query-devtools`
  - Montar `<ReactQueryDevtools />` en `App.tsx` bajo `if (import.meta.env.DEV)`.
  - Objetivo: visibilidad de cache / staleTime / invalidaciones al depurar.
3. `**queryKeys.ts` para features sin factory**
  - Crear `src/features/bandejas/queryKeys.ts` y `src/features/compras/queryKeys.ts`.
  - Migrar los ~15 keys inline detectados (`ComprasConciliacion`, `ComprasNotasCredito`, `ComprasPagos`, `ComprasReportes`, `ConciliacionDetalleSheet`, `useBandejas`, etc.).
  - Beneficio: evita typos en `invalidateQueries` (bug latente).

## Fase 2 · Adoptar `queryOptions()` (patrón moderno v5)

Es el patrón "top-of-the-line" de RQ v5: define **una sola vez** la tupla `(queryKey, queryFn, staleTime)` y la reutilizas en `useQuery`, `prefetchQuery`, `ensureQueryData`, `setQueryData` con tipos automáticos.

- Piloto en 2 features de alto tráfico: `cotizacion` y `embarques` (ya prefetchean).
- Reemplazar los archivos `useCotizacionQueries.ts` / `useEmbarqueQueries.ts` por objetos `queryOptions()` colocalizados con la key factory.
- Aprender del piloto y luego expandir a `dashboard`, `crm`, `facturacion`.

## Fase 3 · Optimistic UI selectivo (`onMutate` + rollback)

Hoy el patrón es "mutación → invalidar → refetch" (correcto pero perceptiblemente lento). Elegir 3 mutaciones "calientes" donde el optimismo se nota:

- Cambio de estado de embarque en el kanban / detalle.
- Marcar tarea de bitácora como completada.
- Toggle de checkboxes en tablas (ej. selección de proformas).

Extender `useMutationWithFeedback` con soporte de `optimisticUpdate({ queryKey, updater })` que ya prepara el snapshot + rollback, sin ensuciar cada hook.

## Fase 4 · Barandales de disciplina

1. **Regla ESLint custom / `no-restricted-syntax**` para prohibir `queryKey: [` en archivos que no terminen en `queryKeys.ts` — fuerza el uso de factories.
2. **Audit puntual de los 98/173 archivos con `useQuery` sin `enabled:**` — spot-check de queries que dependen de `organizationId`/`clienteId` que pueden ser `undefined` en primer render.
3. **Confirmar el único `setQueryData` del proyecto** — asegurar tipado correcto (o migrarlo a `queryOptions().queryKey`).
4. **Evaluar `refetchInterval` de 60 s** en `useAlertasSistema`, `useAppLogsHealth`, `useNotificacionesCliente`: valorar mover a Supabase Realtime (0 costo de polling).

---

## Detalles técnicos

- `**queryOptions()` ejemplo:**
  ```ts
  // src/features/cotizacion/queries.ts
  export const cotizacionByIdOptions = (id: string) => queryOptions({
    queryKey: queryKeys.cotizacion.byId(id),
    queryFn: () => fetchCotizacion(id),
    staleTime: 30_000,
    enabled: !!id,
  });
  // Uso: useQuery(cotizacionByIdOptions(id))
  //      queryClient.prefetchQuery(cotizacionByIdOptions(id))
  ```
- **Suspense Query (opcional futuro Fase 5):** con React 19 + Compiler ya podemos evaluar `useSuspenseQuery` en rutas con `<Suspense>` granulares — encaja con la Fase 5 del plan React previo.

## Fuera de alcance

- Migrar a v6 (aún no existe estable).
- Adoptar TanStack Router / Start (usamos React Router 6, no lo cambiamos aquí).
- Rehacer `DataTable` — hoy está bien encapsulado.

## Entregable por fase

Cada fase termina con: bump `APP_VERSION` + entrada en `CHANGELOG.md`, `typecheck` + `build` + `test:fast` en verde.

## Pregunta

¿Arrancamos por **Fase 1** (higiene: bump + devtools + queryKeys faltantes) o quieres saltar directo a **Fase 2** (piloto `queryOptions()` en cotización/embarques) que es donde está la mejora arquitectónica real? Vamos en orden 

&nbsp;