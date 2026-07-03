## Contexto

Revisando el código encontré un detalle importante: el **tab "Proyección" ya no existe dentro de `/facturacion`** — fue removido y ahora `?tab=proyeccion` redirige a `/reportes/cierre-mensual` (los archivos `TabProyeccion.tsx`, `TabProyeccion` folder y `proyeccionColumns.tsx` quedaron huérfanos).

Entonces no hay un "tab Proyección" al que fusionar. Ajusto la propuesta: en lugar de fusionar con un tab, **degrado la tira roja a un chip compacto** que vive junto a los tabs y sigue abriendo el mismo dialog de detalle. Mantenemos toda la lógica (hook, servicios, dialog, CSV) — solo cambia la presentación de la tarjeta superior.

## Cambios

### 1. Nueva presentación: chip inline

Crear `HuecoFacturacionChip.tsx` (reemplaza a `HuecoFacturacionCard.tsx`):

- **Estado con hueco:** botón/badge rojo compacto `⚠ Hueco: N · $X USD · $Y MXN` que al hacer click abre el `HuecoFacturacionDetalleDialog` existente.
- **Estado sin hueco:** no renderiza nada (silencioso) o muestra un check muy tenue — la ausencia del chip ya es la señal de "todo bien".
- Usa el mismo hook `useHuecoFacturacion` y el mismo dialog — cero cambios de lógica.

### 2. Ubicación

Moverlo a la **derecha de la barra de tabs** (misma línea que "Emitidas" / "Notas de crédito"), dentro del `<div className="flex ... justify-between border-b">` que ya existe en `Facturacion.tsx`. Queda a la vista sin gritar.

### 3. Limpieza en `Facturacion.tsx`

- Quitar `<HuecoFacturacionCard />` (línea 144) y su import (línea 27).
- Actualizar el comentario del encabezado (líneas 10-12) para reflejar que el hueco vive ahora como chip inline.
- Insertar `<HuecoFacturacionChip />` dentro del contenedor de tabs.

### 4. Eliminar `HuecoFacturacionCard.tsx`

Ya no lo usa nadie después del cambio.

### 5. (Opcional, si quieres) limpieza de huérfanos

Fuera de scope estricto, pero puedo aprovechar y borrar `TabProyeccion.tsx`, `proyeccionColumns.tsx` y `components/proyeccion/` si confirmas que no se usan en otro lado. Lo dejo para una segunda pasada.

### 6. Versión y changelog

- Bump a `13.148.1` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md`: "Hueco de facturación degradado a chip inline junto a los tabs; tira superior eliminada."

## Detalles técnicos

**Archivos tocados**
- `src/features/facturacion/components/HuecoFacturacionChip.tsx` (nuevo, ~40 líneas)
- `src/features/facturacion/routes/Facturacion.tsx` (mover import + JSX, actualizar comentario)
- `src/features/facturacion/components/HuecoFacturacionCard.tsx` (eliminar con `rm`)
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

**Sin cambios**
- `useHuecoFacturacion.ts`, servicios, `HuecoFacturacionDetalleDialog.tsx`, CSV, tests — se reutilizan tal cual.

**Analogía:** era un letrero de neón en la entrada; queda como una lucecita discreta en el tablero — sigue prendiendo cuando hay problema, pero no roba protagonismo.
