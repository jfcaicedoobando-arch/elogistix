## Problema

En el header de `src/components/layout/Layout.tsx`, el `SidebarTrigger` (el ícono que abre/colapsa el menú) está envuelto en un `<Tooltip>` de Radix:

```tsx
<Tooltip delayDuration={300}>
  <TooltipTrigger asChild>
    <SidebarTrigger />
  </TooltipTrigger>
  <TooltipContent>Colapsar / expandir menú · ⌘B</TooltipContent>
</Tooltip>
```

En pantallas táctiles (tu viewport actual es 343×605, móvil), Radix Tooltip se comporta así: el **primer tap** abre el tooltip y el **segundo tap** activa el botón. Por eso necesitas hacer "doble clic" en móvil/tablet para que el sidebar se expanda.

En desktop con mouse no se nota porque el tooltip aparece con hover y el click pasa directo.

**Analogía:** es como un portero que primero te pregunta "¿a qué vienes?" (tooltip) y solo en el segundo intento te deja pasar (click). En desktop ves el cartel del portero antes de tocar; en móvil tienes que tocar dos veces.

## Solución propuesta

Deshabilitar el tooltip en dispositivos táctiles, manteniéndolo en desktop donde sí aporta (muestra el atajo ⌘B). Dos opciones:

### Opción A — Recomendada: ocultar el tooltip en touch
Renderizar el `SidebarTrigger` sin `Tooltip` cuando el dispositivo es táctil/móvil, usando el hook `useIsMobile` que ya existe en el proyecto (`src/hooks/shared/useIsMobile.ts`).

```tsx
const isMobile = useIsMobile();

{isMobile ? (
  <SidebarTrigger className="shrink-0" aria-label="Colapsar o expandir menú" />
) : (
  <Tooltip delayDuration={300}>
    <TooltipTrigger asChild>
      <SidebarTrigger className="shrink-0" />
    </TooltipTrigger>
    <TooltipContent side="bottom" className="text-xs">
      Colapsar / expandir menú · <kbd>⌘B</kbd>
    </TooltipContent>
  </Tooltip>
)}
```

- Pros: el tap funciona al primer toque en móvil/tablet; el tooltip sigue intacto en desktop.
- Cons: el `aria-label` reemplaza al tooltip como ayuda accesible en móvil (acepta lectores de pantalla).

### Opción B — Quitar el Tooltip por completo
Eliminar el `Tooltip` del trigger en todos los tamaños y mantener solo un `aria-label` + el atajo de teclado. Más simple pero pierdes la pista visual del atajo `⌘B` en desktop.

Mi recomendación es **Opción A**.

## Archivos a editar

1. `src/components/layout/Layout.tsx` — aplicar el render condicional con `useIsMobile`.
2. `src/constants/appVersion.ts` — bump `APP_VERSION` a `13.95.1`.
3. `CHANGELOG.md` — entrada nueva: "Fix: el botón de expandir/colapsar el sidebar ya no requiere doble tap en dispositivos táctiles."

## Verificación

- Probar con Playwright en viewport móvil (375×800): un solo tap sobre el ícono abre el `Sheet` del sidebar.
- Probar en viewport desktop (1280×800): hover sigue mostrando el tooltip con el atajo, click abre/colapsa normal.

¿Aplico la Opción A?
