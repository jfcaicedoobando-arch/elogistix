## Objetivo
Reemplazar los tooltips básicos (o la ausencia de ellos) de los botones **Consolidar y aprobar** y **Aprobar individual** en el tab **Por timbrar** por tooltips ricos con explicación clara y ejemplos concretos.

## Alcance
- Archivo afectado: `src/features/facturacion/components/TabProformasPendientes.tsx`.
- Se usará el componente `Tooltip` (`src/components/ui/tooltip.tsx`) ya existente en el proyecto (Radix/shadcn).

## Cambios propuestos

### 1. Botón "Consolidar y aprobar"
- Reemplazar el atributo nativo `title` por un `Tooltip` de Radix.
- Contenido del tooltip:
  - **Qué hace:** Fusiona las proformas seleccionadas del **mismo embarque** en una sola proforma consolidada y la aprueba.
  - **Ejemplo:** *"Ejemplo: seleccionas 3 proformas del embarque EXP-00125 (3 contenedores distintos). El sistema las une en una sola proforma con un importe acumulado y la manda a la bandeja de por timbrar."
  - **Cuándo está deshabilitado:** Si seleccionas proformas de embarques diferentes o solo hay 1 seleccionada.

### 2. Botón "Aprobar individual"
- Agregar `Tooltip` (actualmente no tiene ninguno).
- Contenido del tooltip:
  - **Qué hace:** Aprueba cada proforma seleccionada de forma independiente, sin fusionar.
  - **Ejemplo:** *"Ejemplo: seleccionas 2 proformas del embarque EXP-00125 y 1 del EXP-00098. Cada una se aprima por separado y genera su propia factura al timbrar."
  - **Cuándo está deshabilitado:** Si no hay ninguna proforma seleccionada.

### 3. Estilo
- Mantener el estilo por defecto del `TooltipContent` del proyecto (`bg-popover`, `text-popover-foreground`, `text-sm`).
- El contenido puede incluir títulos en negrita (`<strong>`) y saltos de línea (`<br />` o `<p>`) para legibilidad.

## Criterio de aceptación
- [ ] Hacer hover/clic largo en móvil sobre cada botón muestra un tooltip con explicación + ejemplo.
- [ ] No hay regresión visual ni funcional en la selección/consolidación/aprobación.
- [ ] Los textos están en español mexicano y siguen la voz/tomo del resto de la app.