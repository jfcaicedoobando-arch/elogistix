# ADR-001 · Manejo de errores de red en queries del cliente

Fecha: 2026-07-21 · v13.303.75 · Estado: Aceptado

> Revisión documental: 2026-10-02. Conserva la decisión de distinguir fallo/vacío.
> Implementación actual: `src/lib/query/queryErrorReporting.ts` y
> `src/lib/query/queryClient.ts`; los detalles de deduplicación/filtros pueden evolucionar.

## Contexto

Antes de v13.303.75, un fallo de red en una `useQuery` sólo se reportaba a
Sentry. La UI mostraba invariablemente el empty-state "Sin resultados" con
0 filas, indistinguible de "la consulta se ejecutó y no hay datos". Esto
confundía al usuario (creía que había filtrado mal) y ocultaba caídas del
backend.

## Decisión

1. `QueryCache.onError` usa `notifyError` con la operación `QUERY_CACHE` y la
   `queryKey` como contexto. Reemplaza los fallos repetidos de la misma consulta
   conservando el diagnóstico más reciente; permite reintentar y ver el JSON.
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

## Contrato de diagnóstico de notificaciones

- Errores y avisos siempre incluyen «Ver detalles»; una acción primaria como
  «Reintentar» no sustituye el acceso al JSON. Validaciones sin excepción también
  conservan título, mensajes completos, versión, ruta y operación.
- Pasar el error original en `error`, la operación en `method` y los IDs del
  registro en `context`. Si el backend devuelve `requestId`, se conserva y el
  reporte local usa un `clientReportId` separado. No incluir contraseñas ni tokens.
- Errores esperados (`expected: true`) siguen ofreciendo diagnóstico, pero no
  crean incidentes en Sentry. Los fallos parciales conservan su lista de resultados.
- El diálogo ofrece «Copiar JSON» y un campo seleccionable para copiar manualmente
  si el portapapeles falla. «Ver último error» recupera un reporte en memoria tras
  cerrar el aviso; se limpia al cambiar usuario, organización o rol. No es un
  historial persistente ni sustituye un registro de auditoría de negocio.
- No importar Sonner desde features. La guarda de arquitectura detecta imports
  con alias y variantes destructivas condicionales que eluden los helpers.

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
