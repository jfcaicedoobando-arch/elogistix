## Problema
En "Condiciones comerciales" del wizard de cotización, el `Popover` de "Validez de la propuesta" no se cierra al elegir fecha en el calendario. Radix `Popover` no cierra automáticamente al hacer click dentro de su contenido; hay que controlarlo.

## Solución
Convertir el `Popover` en controlado con `useState<boolean>` local (`openValidez`) en `SeccionCondicionesComerciales.tsx` y cerrarlo dentro del `onSelect` del `Calendar` después de guardar la fecha en RHF.

## Cambio puntual
- `src/features/cotizacion/components/SeccionCondicionesComerciales.tsx`:
  - Añadir `const [openValidez, setOpenValidez] = useState(false)`.
  - `<Popover open={openValidez} onOpenChange={setOpenValidez}>`.
  - En `Calendar onSelect`: setear el valor con `setValue(..., { shouldValidate, shouldDirty })` y luego `setOpenValidez(false)` (sólo si `d` está definida).
- Bump `APP_VERSION` a `13.299.3` + entrada en `CHANGELOG.md`.

## Fuera de alcance
Otros date pickers del proyecto (sólo se toca el de validez de propuesta que reportó el usuario).

## Analogía
El calendario es como un cajón: hoy metes el papel y lo dejas abierto; el fix es cerrarlo automáticamente al soltar el papel.
