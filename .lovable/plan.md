## Problema

Al pulsar "Seleccionar elemento" dentro del modal de reportar bug/mejora, la app queda inutilizable: no se puede seleccionar nada y, al cerrar, los clics dejan de responder.

## Causa

En `src/components/feedback/FeedbackDialog.tsx` el `Dialog` se controla con:

```tsx
<Dialog open={open && !pickerActive} ...>
```

Cuando el picker se activa, `pickerActive` pasa a `true` y el `Dialog` **se desmonta**. Al desmontarse:

1. `FeedbackForm` se desmonta y con él el hook `useElementPicker`, cuyo cleanup elimina los listeners de `mousemove/click/keydown` que acaban de instalarse. El picker nunca llega a capturar nada.
2. Radix Dialog deja por unos instantes `pointer-events: none` en `body` durante su animación de cierre, bloqueando clicks en toda la página.
3. Los datos del formulario (título, descripción, imágenes) se pierden porque el componente se desmonta.

Además el overlay/contenido del Dialog tienen z-index alto y, aunque el picker tiene `z-index: 2147483646/7`, el overlay sigue interceptando eventos cuando el Dialog está abierto.

## Cambio

En `src/components/feedback/FeedbackDialog.tsx`:

1. Mantener el `Dialog` **siempre montado** mientras `open` sea `true` (no cerrarlo por `pickerActive`).
2. Cuando `pickerActive` sea `true`, ocultar visualmente el contenido y dejarlo pasar clics:
   - Añadir clase condicional al `DialogContent`: `pickerActive && "opacity-0 pointer-events-none"`.
   - Forzar que el overlay de Radix también deje pasar clics: pasar `data-picker-active` al `DialogContent` y agregar en `src/index.css` (o estilo inline vía un wrapper) una regla que ponga `pointer-events: none` sobre `[data-radix-dialog-overlay]` mientras el picker esté activo. Alternativa más simple y autocontenida: setear desde el componente `document.body.style.pointerEvents = ''` y aplicar `pointer-events: auto` solo al overlay del picker (que ya lo es porque es un div suelto en `body`); para anular el overlay del dialog, usar un `useEffect` que mientras `pickerActive` añada al `body` una clase `feedback-picker-active` y en `src/index.css` declarar:
     ```css
     body.feedback-picker-active [data-radix-dialog-overlay],
     body.feedback-picker-active [role="dialog"] { pointer-events: none !important; opacity: 0 !important; }
     ```
3. No tocar la lógica del hook `useElementPicker` ni `FeedbackForm`: con el Dialog montado, los listeners persisten y el estado del formulario se conserva.
4. Al terminar el picker (click o Esc), `onPickerActiveChange(false)` ya restaura la visibilidad del Dialog.

Mantener el guard de `onOpenChange` para no permitir cerrar el dialog mientras `mutation.isPending`.

## Verificación

- Abrir el modal, llenar título/descr, pulsar "Seleccionar elemento": el modal desaparece visualmente, el hint "Click para seleccionar · Esc para cancelar" aparece, el cursor es crosshair y el outline azul sigue al mouse.
- Hacer click en cualquier elemento de la página: el modal reaparece con el selector capturado y los textos del formulario intactos.
- Pulsar Esc durante el picker: el modal reaparece sin selección y la página vuelve a responder a clics normales.
- Repetir el flujo varias veces sin recargar.

## Changelog

Agregar entrada `8.227.1` (patch) en `src/content/changelog/v8/chunks/0.ts` con fecha 19/05/2026: "Fix: el selector de elemento del reporte de bug/mejora ya no congela la app; el modal se oculta mientras seleccionas y vuelve con la selección capturada".

Actualizar `APP_VERSION` en `src/constants/appVersion.ts` a `8.227.1`.
