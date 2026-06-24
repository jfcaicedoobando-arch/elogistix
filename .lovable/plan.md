## Causa

El `Popover` con la lista de rutas vive dentro del `Dialog` del modal (Radix Dialog usa `RemoveScroll`, que bloquea eventos `wheel` que llegan al `body`). El `CommandList` sí tiene `overflow-y-auto` con `max-h-[300px]`, pero los eventos de rueda burbujean al bloqueador antes de scrollear la lista interna.

## Solución (puntual, no toca el primitivo global)

En `src/features/costeo/components/MultiRutaSelect.tsx` agregar `onWheel={(e) => e.stopPropagation()}` al `CommandList` (envolverlo con un wrapper o pasarle el handler directo). Esto deja que el navegador haga el scroll natural del contenedor antes de que `RemoveScroll` intercepte el evento.

Opcionalmente, también dar `onWheelCapture` al `PopoverContent` para reforzar.

Sin cambios en `ui/command.tsx` ni `ui/popover.tsx` para no afectar otros usos (Ctrl+K global ya funciona porque su Dialog es el propio contenedor scrolleable).

## Validación

Abrir `/agente/tarifas` → "Nueva tarifa" → abrir combobox de rutas → con muchas rutas debe poder scrollearse con la rueda del mouse y con trackpad. Validar también con teclado (↑/↓) que sigue funcionando.

## Versión

- `src/constants/appVersion.ts` → `13.135.33`
- `CHANGELOG.md` → `[13.135.33]`: "fix: scroll wheel funciona en el selector múltiple de rutas dentro del modal Nueva tarifa."
