# ADR-001 · Manejo de errores de red en queries del cliente

Fecha: 2026-07-21 · v13.303.75 · Estado: Aceptado

## Contexto

Antes de v13.303.75, un fallo de red en una `useQuery` sólo se reportaba a
Sentry. La UI mostraba invariablemente el empty-state "Sin resultados" con
0 filas, indistinguible de "la consulta se ejecutó y no hay datos". Esto
confundía al usuario (creía que había filtrado mal) y ocultaba caídas del
backend.

## Decisión

1. `QueryCache.onError` emite `toast.error("No pudimos cargar la información")`
   con `id = query-error:<root>` para deduplicar cascadas de la misma pantalla.
2. Las queries que ya manejan su propio feedback (mutaciones a UI custom,
   background prefetch) pueden optar por `meta: { silentError: true }` en su
   definición para suprimir el toast.
3. `DataTable` acepta `isError` + `onRetry`. Cuando `isError=true` pinta
   `ErrorStateInline` en lugar del `emptyState`, y oculta la paginación.
4. Rutas de alto tráfico (`Embarques`, `CxP`) exponen `isError` y `refetch`
   desde su hook/controller. Muestran `ErrorState` (o `DataTable` con
   `isError`) antes de considerar el empty-state.

## Consecuencias

- El usuario distingue "no hay datos" de "no pudimos cargar". Puede
  reintentar sin recargar la página.
- Los toasts se agrupan por root de queryKey para no saturar en errores
  masivos (p. ej. una caída de red que dispara 20 queries en paralelo).
- Nuevas rutas deben exponer `isError`/`refetch` desde su hook y propagarlo
  a `DataTable` o mostrar `ErrorState`.

## Cómo aplicar en nueva pantalla

```tsx
const { data, isLoading, isError, refetch } = useMisDatos();
return (
  <DataTable
    columns={cols}
    data={data ?? []}
    isLoading={isLoading}
    isError={isError}
    onRetry={() => refetch()}
    rowKey={(r) => r.id}
  />
);
```
