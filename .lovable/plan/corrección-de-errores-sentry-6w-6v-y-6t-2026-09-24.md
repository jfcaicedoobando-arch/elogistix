# Corrección de errores Sentry 6W/6V y 6T

## Diagnóstico (verificado en código)

**6W/6V — "No pudimos cargar la información" al editar un embarque inexistente.**
`fetchEmbarqueById` (`src/features/embarques/services/queries/detalle.ts`) usa `.single()`: cuando el embarque no existe (eliminado o de otra empresa), la base de datos responde con error PGRST116 y la pantalla de edición (`EditarEmbarque.tsx`) cae en el `ErrorState` genérico "No se pudo cargar la información… Reintentar", como si fuera una falla de red. La pantalla ya tiene un estado amable de "Embarque no encontrado" con botón Volver, pero nunca se alcanza porque el caso llega como error.

**6T — PDF de cotización falla tras un deploy.**
`CotizacionDetalle.tsx` carga el generador de PDF con `import()` dinámico. Si el usuario tiene la app abierta desde antes de una publicación, ese archivo ya no existe en el servidor y la exportación falla con el toast genérico "No se pudo generar el PDF". Ya existe la utilidad `tryReloadForChunkError` (`src/lib/errors/dynamicImportError.ts`) que detecta exactamente este caso, muestra "Hay una versión nueva disponible. Actualizando…" y recarga sola (con límite anti-bucles), pero `usePdfExport` no la usa.

## Cambios

### 1. Embarque no encontrado con mensaje claro (6W/6V)
- `detalle.ts`: cambiar `.single()` por `.maybeSingle()` y devolver `null` cuando no hay fila (tipo `EmbarqueRow | null`). Un embarque inexistente deja de ser un "error" y pasa a ser un dato vacío.
- `EditarEmbarque.tsx` ya muestra "Embarque no encontrado" + botón Volver cuando `embarque` es null — se alcanzará sin más cambios.
- Verificar los demás consumidores de `fetchEmbarqueById` (detalle, hooks relacionados) para que el `null` fluya a sus estados de "no encontrado" existentes en vez de romper tipos.
- Los errores reales (red, permisos) siguen mostrando el `ErrorState` con Reintentar.

### 2. Reintento automático del PDF tras deploy (6T)
- `src/hooks/shared/usePdfExport.ts`: en el `catch`, si `isDynamicImportError(error)` es verdadero, llamar `tryReloadForChunkError()` (overlay "Actualizando…" + recarga automática, máx. 2 intentos, luego botón Recargar manual) en lugar del toast genérico. Cualquier otro error sigue con `notifyError` como hoy.
- Beneficia a todos los exportadores PDF que usan el hook (cotización, informativa, etc.), no solo al caso reportado.

## Pruebas focalizadas
- `detalle.test.ts`: caso "0 filas → null, sin throw" y caso de error real que sí lanza.
- Test del wizard de edición: embarque null muestra "Embarque no encontrado" (si ya existe cobertura, ajustar).
- Test de `usePdfExport`: error de chunk dinámico dispara la recarga y NO muestra toast genérico; error normal sí muestra toast.
- `bunx vitest run` sólo de los archivos tocados + typecheck/lint focalizado.

## Fuera de alcance
- Sin cambios de base de datos, versión, CHANGELOG ni publicación.
- 6M (aviso de factura con fecha de ayer): el texto ya no existe en el código; se marcará como resuelto en Sentry al aplicar este lote, junto con 6W/6V/6T.
- CI/RLS completos quedan en GitHub Actions.
