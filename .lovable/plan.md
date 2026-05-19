## Diagnóstico

Dos bugs reales hacen que el picker no responda:

### 1. La pantalla queda borrosa (overlay del Dialog visible)

La regla CSS en `src/index.css` apunta a `[data-radix-dialog-overlay]`, pero Radix **no** emite ese atributo. El overlay real es un `<div>` con `bg-foreground/40 backdrop-blur-sm` (ver `src/components/ui/dialog.tsx:22`). Por eso al activar el picker el overlay sigue ahí: la pantalla se ve oscura y borrosa, y aunque los clicks "pasan" visualmente confunde al usuario.

### 2. Es imposible seleccionar nada

En `src/index.css:195` aplicamos:

```css
html.feedback-picker-active body *:not(#feedback-picker-overlay)... {
  pointer-events: none !important;
}
```

`document.elementFromPoint()` **ignora elementos con `pointer-events:none`** y devuelve el primero "alcanzable" debajo, que casi siempre termina siendo `<body>`. El hook descarta body/html en `paint()`, así que el highlight nunca aparece sobre nada útil y el click captura `<body>`. El picker queda "muerto".

## Cambios

### A. `src/components/feedback/FeedbackDialog.tsx` — eliminar el overlay durante el picker

Reemplazar `Dialog/DialogContent` por una composición con primitivas Radix (`DialogPrimitive.Root`, `Portal`, `Content`) y condicionar el render del `DialogOverlay` a `!pickerActive`. Mantener el `<DialogContent>` montado (con `opacity:0` como ya está) para preservar el estado del `FeedbackForm`.

Alternativa más simple y suficiente: aplicar `style={{ opacity: 0, pointerEvents: 'none' }}` directamente sobre el overlay vía un wrapper que use Radix primitives. Implementación concreta:

- Importar `* as DialogPrimitive from "@radix-ui/react-dialog"`.
- Componer manualmente:
  ```
  <DialogPrimitive.Root>
    <DialogPrimitive.Portal>
      {!pickerActive && <DialogOverlay/>}
      <DialogPrimitive.Content className={cn(... contentBaseClasses, pickerActive && "opacity-0 pointer-events-none")}>
        ...header, tabs, form...
        <DialogPrimitive.Close ... />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
  ```
- Copiar las clases que ya usaba `DialogContent` para que se vea igual.

Resultado: cuando `pickerActive`, no hay overlay ni blur; la página vuelve a verse nítida.

### B. `src/index.css` — quitar el bloqueo global de pointer-events

- Borrar la regla `html.feedback-picker-active body *:not(...) { pointer-events: none !important; }` (rompe `elementFromPoint`).
- Borrar también el bloque ahora inútil de `[data-radix-dialog-overlay]`.
- Conservar **solo** el bloqueo de tooltips/popovers (Radix) para que la app no muestre tooltips fantasma mientras se hace pick:
  ```css
  html.feedback-picker-active [data-radix-tooltip-content],
  html.feedback-picker-active [data-radix-popper-content-wrapper],
  html.feedback-picker-active [data-state="delayed-open"][role="tooltip"] {
    display: none !important;
  }
  ```
- Añadir un cursor global mientras el picker está activo:
  ```css
  html.feedback-picker-active, html.feedback-picker-active * { cursor: crosshair !important; }
  ```

### C. `src/hooks/feedback/useElementPicker.ts` — resolver target con `elementsFromPoint`

Aunque al quitar la regla de pointer-events `elementFromPoint` ya funciona, blindamos el picker para que no devuelva nuestros propios overlays:

- Cambiar `resolveFromPoint` para usar `document.elementsFromPoint(x, y)` y tomar el primer elemento que **no** sea `#feedback-picker-overlay`, `#feedback-picker-label`, `#feedback-picker-hint`, ni `body`/`html`.
- Aplicar la lógica híbrida (Alt = exacto, default = `pickMeaningfulAncestor`) sobre ese resultado.
- Como red de seguridad, antes de hacer hit-test ocultar momentáneamente nuestros overlays con `style.pointerEvents = 'none'` (ya lo tienen) y `style.visibility` no es necesario porque `elementsFromPoint` los filtramos por id.
- Mover los listeners (`mousemove`, `click`, `contextmenu`, `keydown`, `keyup`) a `window` con `capture: true` para asegurar que se reciben aunque algún elemento intercepte.

### D. Versionado y changelog

- `src/constants/appVersion.ts` → `8.227.3`.
- `src/content/changelog/v8/chunks/0.ts` → entrada patch `8.227.3`: "Picker de elemento del reporte: se elimina el blur del modal mientras se selecciona y se corrige la captura de clicks que dejaba el cursor 'muerto' sobre la página".

## Verificación

1. Abrir modal de reportar bug → click **Seleccionar elemento**.
2. La pantalla deja de estar borrosa/oscura: se ve la app nítida con el outline azul y la etiqueta flotante.
3. Mover el mouse sobre cualquier botón / fila / card: el outline se actualiza y la etiqueta muestra `tag — texto`.
4. Click sobre el elemento → modal reaparece con `selector` y `texto` poblados.
5. `Alt` cambia a granularidad exacta; `↑/↓` navega padre/hijo; `Enter` confirma; `Esc` y click derecho cancelan.
6. Pasar el mouse sobre el sidebar **no** abre tooltips ni el menú colapsado mientras el picker está activo.
7. Tras cerrar el picker, los tooltips y el overlay del Dialog vuelven a la normalidad.

## Archivos modificados

- `src/components/feedback/FeedbackDialog.tsx` — composición con primitivas Radix, overlay condicional.
- `src/index.css` — eliminar regla global de pointer-events y la regla muerta del overlay; mantener bloqueo de tooltips; añadir cursor.
- `src/hooks/feedback/useElementPicker.ts` — `elementsFromPoint` con filtrado, listeners en `window`.
- `src/constants/appVersion.ts` — `8.227.3`.
- `src/content/changelog/v8/chunks/0.ts` — entrada `8.227.3`.
