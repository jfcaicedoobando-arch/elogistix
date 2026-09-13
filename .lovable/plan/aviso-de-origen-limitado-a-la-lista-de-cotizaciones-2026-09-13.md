# Aviso de origen limitado a la lista de cotizaciones

## Cambio

- Reemplazar el aviso global que dispara **Ver cotizaciones** por el aviso local ya existente en `/cotizaciones`.
- Navegar a la lista con el mismo indicador de origen que usa el flujo actual, sin cambiar la conversión de cotización a embarque.
- Hacer que el aviso local sólo se renderice en la ruta exacta `/cotizaciones`; al abrir `/cotizaciones/nueva` desaparecerá automáticamente.

## Regresión

- Agregar pruebas para confirmar que el aviso aparece en la lista cuando se llega desde Embarques, no aparece en `/cotizaciones/nueva` y puede cerrarse.
- Mantener la versión, changelog y manifiesto de release sincronizados.

## Validación local

- Pruebas focalizadas del aviso y la CTA.
- Typecheck, lint focalizado, build y auditoría del manifiesto.
- CI/RLS/E2E completos quedan para GitHub Actions.

## Fuera de alcance

- No se modifican permisos, reglas de negocio, datos ni el flujo de conversión.
