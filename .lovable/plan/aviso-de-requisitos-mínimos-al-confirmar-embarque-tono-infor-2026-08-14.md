# Aviso de requisitos mínimos al confirmar embarque: tono informativo

Hoy, al intentar pasar un embarque a **Confirmado** sin peso o sin naviera, aparece un toast rojo de error con "Ver detalles" y un `requestId`, como si el sistema hubiera fallado. En realidad es una validación de captura previa (no hay llamada al servidor ni excepción).

## Cambio

Convertir ese aviso en un mensaje informativo (amarillo) con una lista clara de lo que falta:

- Título: `Aún falta información para confirmar`
- Descripción: `Captura estos datos y vuelve a intentar: peso mayor a 0 kg, naviera.`
- Sin panel de "Ver detalles" ni `requestId` (no es un error reportable).
- Duración normal en lugar de persistente.

El resto del comportamiento no cambia: el embarque sigue sin avanzar hasta que se completen los campos, y las demás validaciones (documentos, cierre, transiciones inválidas) mantienen su tratamiento actual como errores.

## Detalles técnicos

- `src/features/embarques/hooks/useEmbarqueEstadoActions.ts`: en `handleAvanzarEstado`, reemplazar la llamada `notifyError(...)` del bloque `faltantesParaConfirmado` por `notifyWarning` de `@/lib/ui/appFeedback`, sin pasar `method`/`error` para que no se adjunte el reporte de diagnóstico.
- Sin cambios en `useEmbarqueEstadoActions.helpers.ts` (la lógica de `faltantesParaConfirmado` queda igual).
- Actualizar `CHANGELOG.md` y bump de `APP_VERSION` a `13.623.1`.
