## Problema

El picker actual de "Seleccionar elemento" (en el modal de reportar bug/mejora) brinca entre nodos hijos (spans, icons, svg dentro de un botón), el outline se mueve de forma abrupta, no se ve qué se está por capturar y un click accidental termina la selección con un nodo poco útil.

## Cambios

Refinar `src/hooks/feedback/useElementPicker.ts` y `src/lib/feedback/elementSelector.ts`. Sin tocar `FeedbackForm`, `FeedbackDialog` ni la base de datos.

### 1. Granularidad híbrida (componente por defecto, exacto con Alt)

- Nuevo helper `pickMeaningfulAncestor(el)` en `elementSelector.ts`: sube por `parentElement` hasta encontrar el primer "componente útil":
  - `[data-testid]`, `[role="button"]`, `<button>`, `<a>`, `<tr>`, `<li>`, `<label>`, `<input>`, `<select>`, `<textarea>`, `[data-feedback-target]`, o elementos con `aria-label`.
  - Tope: máximo 6 niveles arriba o hasta que el rect supere el 80% del viewport (evita seleccionar `<main>`/`<body>`).
- Mientras el mouse se mueve, el target resaltado es el ancestro útil. Si el usuario mantiene `Alt` (o `Shift`), se usa el elemento exacto bajo el cursor. Al soltar, vuelve al ancestro.

### 2. Estabilidad visual

- Throttle del `mousemove` con `requestAnimationFrame` (descartar el último pendiente al recibir uno nuevo) en lugar de actualizar el style en cada evento.
- En el overlay: cambiar `transition: all 60ms ease` por `transition: transform 90ms ease, width 90ms ease, height 90ms ease, opacity 120ms ease` y posicionar con `transform: translate(x,y)` en vez de `left/top` (evita re-layout y suaviza el movimiento).
- Si el nuevo target es el mismo nodo que el anterior, no actualizar.

### 3. Etiqueta flotante con tag + texto

- Crear un segundo div `label` flotante que muestre: `tagName.classToken` (ej. `button.primary`) y, si hay, un snippet ≤40 chars del `innerText`.
- Se posiciona arriba del rect del target (o debajo si no cabe), pegado al borde izquierdo, con el mismo z-index del overlay.
- Mientras se mantiene `Alt`, la etiqueta agrega el sufijo `· exacto`.

### 4. Bloquear hovers/tooltips de la app

- Mientras el picker esté activo:
  - Añadir clase `feedback-picker-active` en `<html>` (ya se hace en `body` para ocultar el dialog overlay; ampliar el alcance).
  - En `src/index.css`, agregar reglas que mientras esa clase esté presente:
    - Anulen `pointer-events` sobre los hijos directos: `html.feedback-picker-active *:not(#feedback-picker-overlay):not(#feedback-picker-label):not(#feedback-picker-hint) { pointer-events: none !important; }` — esto evita que botones/links disparen hover, tooltips de Radix, abran menús, etc. El picker captura el click en captura phase con `document` así que sigue funcionando.
    - Oculten Radix tooltips/popovers nuevos: `html.feedback-picker-active [data-radix-tooltip-content], html.feedback-picker-active [data-radix-popper-content-wrapper] { display: none !important; }`.

### 5. Cancelar con click derecho + navegar con flechas

- Añadir handler global `contextmenu` (captura): `preventDefault()` + cierra el picker con `onPicked(null)`.
- Añadir handlers de `keydown` para:
  - `ArrowUp`: sube al `parentElement` válido (saltando body/html) y rehace el highlight.
  - `ArrowDown`: vuelve al hijo previo recordado en un stack (cada `ArrowUp` empuja al hijo actual al stack).
  - `Enter`: confirma la selección del target resaltado actual.
  - `Esc`: cancela (ya existe).
- El estado del target navegado se guarda en un `useRef` (`currentTarget`); cualquier `mousemove` lo resetea al elemento bajo el cursor (con su lógica híbrida).

### 6. Hint actualizado

Cambiar el texto del hint a una sola línea legible:

`Click: seleccionar · Alt: exacto · ↑↓: padre/hijo · Enter: confirmar · Esc/Click derecho: cancelar`

### 7. Selector más estable

En `buildSelector`:
- Si hay `[data-testid]`, retornarlo (ya existe).
- Si no, y el elemento tiene `aria-label`, retornar `tag[aria-label="..."]`.
- Mantener el fallback de `:nth-of-type`.

## Verificación

- Abrir modal, pulsar "Seleccionar elemento", mover el mouse sobre un botón con icono y texto: el outline rodea el botón completo (no salta al `<svg>` ni al `<span>` interno) y se queda estable mientras se mueve dentro de él.
- Mantener `Alt`: el outline cae al hijo exacto (svg, span); la etiqueta muestra `… · exacto`.
- Pasar el mouse sobre filas de tabla: se resalta el `<tr>` completo, no la `<td>`.
- Hover sobre el sidebar no dispara tooltips ni abre el menú colapsado.
- Pulsar `↑` selecciona el contenedor padre, `↓` vuelve al elemento original; `Enter` confirma.
- Click derecho en cualquier lugar cancela y restaura los hovers normales.
- El movimiento del outline es suave (sin flicker visible a 60Hz).
- Tras seleccionar, el modal reaparece con el selector capturado y los datos intactos.

## Archivos modificados

- `src/hooks/feedback/useElementPicker.ts` — lógica nueva (throttle rAF, alt-key, flechas, contextmenu, label flotante, ids únicos en overlay/hint/label).
- `src/lib/feedback/elementSelector.ts` — `pickMeaningfulAncestor`, mejora de `buildSelector` con aria-label.
- `src/index.css` — reglas para `html.feedback-picker-active` (bloqueo de hovers y tooltips).
- `src/components/feedback/FeedbackDialog.tsx` — aplicar la clase en `<html>` además de `<body>` (una línea).
- `src/constants/appVersion.ts` — `8.227.2`.
- `src/content/changelog/v8/chunks/0.ts` — entrada patch `8.227.2`: "Selector de elemento del reporte: granularidad híbrida (componente por defecto, Alt = exacto), movimiento suave, etiqueta flotante con tag y texto, navegación con ↑↓, cancelar con click derecho, y se bloquean hovers/tooltips de la app durante la selección".
