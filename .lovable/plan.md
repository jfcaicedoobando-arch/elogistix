# P1-1 · Skeleton infinito sin timeout ni error (transversal)

## Problema confirmado

`Embarques` ya sigue el patrón bueno (ADR-001): expone `isError` + `refetch` y pinta
`ErrorState` con botón "Reintentar". El resto de las rutas de alto tráfico no:

- `Cartera` sólo usa `isLoading` (nunca `isError`, sin reintento).
- `Tesoreria` muestra `KpiGridSkeleton` cuando `isLoading || !data` — si la consulta
  falla, `data` queda `undefined` y el esqueleto se queda para siempre.
- `Configuracion` hace `if (isLoading) return <ListSkeleton/>` sin rama de error.
- `Usuarios` descarta por completo el estado de las tres queries (`useUsuarios`, portal
  cliente, portal agente): sólo lee `data = []`, así que un fallo se ve como "sin usuarios".
- `Facturacion` pasa `isLoading` a la tabla pero no `isError`/`onRetry`.
- El wizard de embarque y otras pantallas de detalle repiten el mismo patrón.

Las piezas de UI ya existen (`ErrorState`, `ErrorStateInline`, `LoadingState` con timeout,
`DataTable` con `isError`/`onRetry`, `useCargaExpirada`); lo que falta es aplicarlas.

## Qué se va a construir

### 1. Primitiva compartida: `<AsyncBoundary>`

Nuevo componente en `src/components/shared/states/AsyncBoundary.tsx` que recibe
`isLoading`, `isError`, `onRetry`, `skeleton` y `children`, y decide:

```text
isError            -> <ErrorState onRetry>
isLoading + expiró -> <ErrorState "Está tardando más de lo normal" onRetry>
isLoading          -> skeleton recibido
resto              -> children
```

El "expiró" reutiliza `useCargaExpirada` (20 s) para que ningún esqueleto quede
colgado indefinidamente aunque la query nunca resuelva ni falle.

### 2. Aplicar en las rutas afectadas

Cada ruta expone `isError` + `refetch` desde su hook/controller y los propaga:

| Ruta | Cambio |
| --- | --- |
| `/cartera` | `useCarteraPage` devuelve `isError`/`refetch`; `DataTable` recibe `isError`+`onRetry`; lista móvil idem |
| `/tesoreria` (+ cuentas, conciliación, flujo, pagos programados) | `AsyncBoundary` alrededor de KPIs y tablas; se elimina la condición `|| !data` que congela el esqueleto |
| `/configuracion` | rama de error con "Reintentar" en lugar de esqueleto perpetuo |
| `/usuarios` | leer `isLoading`/`isError`/`refetch` de las 3 queries y envolver cada pestaña en `AsyncBoundary` |
| `/facturacion` | pasar `isError` + `onRetry` al `DataTable` |
| Wizard de embarque / cotización | `AsyncBoundary` en los pasos que dependen de catálogos remotos |

### 3. Candado de regresión

- Test unitario de `AsyncBoundary` (esqueleto → error por timeout → error explícito → contenido),
  con reloj falso.
- Test de auditoría que recorre las rutas listadas y falla si un archivo usa
  `isLoading` de una query sin manejar también `isError`, para que nuevas pantallas
  no reintroduzcan el patrón.

### 4. Documentación

- Actualizar `docs/adr/ADR-001-network-error-handling.md` con `AsyncBoundary` como forma
  recomendada para pantallas que no son tabla.
- Entrada en `CHANGELOG.md` y bump de `APP_VERSION` (minor).

## Notas técnicas

- Sin cambios de backend, ni de RLS, ni de queries: sólo capa de presentación y hooks
  de UI que ya llaman a TanStack Query.
- `queryClient` ya reintenta 2 veces con backoff y `QueryCache.onError` ya emite el toast
  deduplicado; este trabajo cubre lo que falta: el bloque de contenido y el reintento manual.
- Los componentes tocados se mantienen bajo 200 líneas (Power of 10); si alguna ruta se
  pasa, se extrae la sección a un subcomponente.
