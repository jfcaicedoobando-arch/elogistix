## Problema

En el card "Arribos este mes" del dashboard, los dos tooltips (Profit proyectado y Gastos fijos cubiertos) usan `Tooltip` de Radix, que sólo se abre al hacer **hover/focus**. En mobile no hay hover, así que un tap rara vez los muestra y, cuando lo hacen, el ancho fijo (`320px` / `280px`) se sale del viewport de 343px.

Analogía: es como poner un cartel que sólo aparece "cuando pasas el dedo por encima sin tocar" — en una pantalla táctil eso no existe, hay que tocarlo.

## Solución

En `src/features/dashboard/components/statusCards/ArribosCard.tsx`:

1. Detectar mobile con el hook existente `useIsMobile()` (`@/hooks/shared`).
2. Para los dos botones (Profit y Cobertura), envolver el contenido en un componente condicional:
   - **Desktop**: sigue usando `Tooltip` + `TooltipContent` (hover, sin cambios funcionales).
   - **Mobile**: usa `Popover` + `PopoverTrigger` + `PopoverContent` para que abra al **tap**.
3. Ajustar el ancho del contenido para que nunca rebase la pantalla:
   - Reemplazar `w-[320px]` / `w-[280px]` por `w-[min(320px,calc(100vw-2rem))]` y `w-[min(280px,calc(100vw-2rem))]`.
   - Añadir `collisionPadding={8}` y `sideOffset={8}` para evitar que se pegue al borde.
4. Mantener el ícono `Info` como pista visual de que es interactivo.
5. No tocar `ArribosCardTooltips.tsx` (el contenido es el mismo en ambos casos).

## Detalles técnicos

- `Popover` ya existe en `@/components/ui/popover` (shadcn). Se importa junto con `Tooltip`.
- Patrón sugerido: un pequeño helper local `<InfoPopover trigger={...} content={...} contentWidthClass={...} />` que internamente decide Tooltip vs Popover según `useIsMobile()`. Vive en el mismo archivo para no inflar el árbol.
- El archivo queda por debajo de 200 líneas (Power of 10).

## Changelog

- Bump `APP_VERSION` (patch) y entrada en `CHANGELOG.md`:
  - "Dashboard mobile: los tooltips de Profit proyectado y Gastos fijos cubiertos ahora abren con tap y se ajustan al ancho de la pantalla."

## Fuera de alcance

- No se cambia el contenido de los tooltips ni la lógica financiera.
- No se tocan otros cards del dashboard (sólo `ArribosCard`).
