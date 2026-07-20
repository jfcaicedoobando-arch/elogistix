## Problema

El botón "Avanzar a Cotización" en el header del embarque sigue mostrando el valor crudo de BD (`Cotización`) en vez de la etiqueta cosmética `Propuesta` introducida en v13.303.17.

## Causa

`src/features/embarques/components/header/AvanzarEstadoButton.tsx` interpola directamente `siguienteEstado` (que viene de `getSiguienteEstado` → valor de enum de BD) sin pasarlo por `labelEstadoEmbarque(...)`. También se interpola crudo en el diálogo de confirmación, el diálogo de "Faltan documentos" y el tooltip.

`estadoVisual` sufre lo mismo dentro del texto "cambiar el estado de X a Y".

## Cambios

Único archivo tocado: `src/features/embarques/components/header/AvanzarEstadoButton.tsx`.

1. Importar `labelEstadoEmbarque` desde `@/features/embarques/constants/estadoEmbarqueLabels`.
2. Calcular una sola vez al inicio del componente:
   - `const siguienteLabel = labelEstadoEmbarque(siguienteEstado);`
   - `const actualLabel = labelEstadoEmbarque(estadoVisual);`
3. Sustituir todas las apariciones de `{siguienteEstado}` por `{siguienteLabel}` (botón principal, tooltip, título del alert de documentos faltantes) y `{estadoVisual}` por `{actualLabel}` en la descripción del confirm dialog.
4. Se conservan las props `siguienteEstado` / `estadoVisual` con el valor de BD (para no romper llamadores ni la lógica interna) — sólo cambia lo mostrado.

## Sin cambios

- No se toca `getSiguienteEstado`, ni RPCs, ni el mapa `ESTADO_EMBARQUE_LABELS`.
- No se afecta lógica de negocio ni de permisos.

## Versión

Bump `APP_VERSION` a `13.303.20` + entrada breve en `CHANGELOG.md` describiendo el fix de la etiqueta del botón.
