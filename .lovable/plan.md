# Fix: menú "+ Nuevo" se abre solo al entrar al CRM

## Causa
`CrmLayout` inicializa `openTrigger` en `0`, y `QuickAddMenu` tiene un `useEffect` que abre el menú cada vez que `openTrigger` cambia, ignorando solo el caso `undefined`. Como `0 !== undefined`, en el primer render el efecto corre y abre el dropdown automáticamente. Lo mismo aplica a `dialogTrigger` si llegara a inicializarse.

## Cambio (1 archivo)

**`src/components/crm/QuickAddMenu.tsx`** — ignorar el primer render del efecto, no el valor:

- Reemplazar el `useEffect` de `openTrigger` por un patrón con `useRef` que salte la ejecución inicial y solo abra el menú cuando el valor cambie tras montaje.
- Aplicar el mismo guard al `useEffect` de `dialogTrigger` para evitar que un valor inicial inesperado dispare un popover.

Pseudocódigo:

```ts
const firstOpen = useRef(true);
useEffect(() => {
  if (firstOpen.current) { firstOpen.current = false; return; }
  if (openTrigger === undefined) return;
  setMenuOpen(true);
}, [openTrigger]);
```

(Equivalente para `dialogTrigger`.)

## Verificación
- Entrar a `/crm` → el menú "+ Nuevo" permanece cerrado.
- Presionar `N` → abre el menú.
- Presionar `L` / `O` / `A` → abre el popover correspondiente.
- Botón "+ Nuevo" clickeable manualmente sigue funcionando.

## Mantenimiento
- Bump `APP_VERSION` patch (12.60.x).
- Entrada en `CHANGELOG.md` describiendo el fix.
