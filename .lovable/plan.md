## Diagnóstico visual (vista Agrupada `/costeo/tarifas`)

Verifiqué en el preview a 1920×1080 con sesión de `admin@chino.com` filtro **Pendientes (5)**. Encontré 4 problemas en la tabla donde se autorizan tarifas:

1. **Cabecera de columnas repetida** en cada Card de ruta (5 veces para 5 rutas). Genera ruido visual y rompe la lectura como tabla.
2. **Anchos de columna desalineados** — `grid-cols-[1fr_140px_160px_150px_auto]`:
   - "ESTADO" header está `text-right` pero el badge "Pendiente" usa `flex justify-end` dentro de 160px → queda flotando lejos del total.
   - "TOTAL USD" en 150px obliga al subtítulo `Flete USD 5,000.00 · Recargos USD 110.00` a partirse en dos líneas, inflando el alto de fila.
   - Columna "ACCIONES" header existe pero en estado normal sólo se ve un `⋯` (los botones rápidos están en `opacity-0 group-hover`), dejando hueco perceptivo grande.
3. **Mini-barra de vigencia** (`VigenciaBar`) se ve como una línea suelta debajo de la fecha; con periodos en el futuro (`progress=0`) sólo queda el track gris, dando impresión de "subrayado roto".
4. **Header del grupo** (azul/gris) compite con el header de columnas inmediato debajo: dos barras grises seguidas con tipografía similar.

## Cambios propuestos (sólo presentación)

### A. Consolidar cabecera de columnas
- Mover `<TarifaColumnHeader />` fuera del loop de grupos en `TarifasGroupedView.tsx`: una sola cabecera arriba de la lista de Cards, sticky (`sticky top-0 z-10 bg-background`).
- Quitar el render por-Card.

### B. Rebalancear grid
- En `TarifaFila.tsx`, cambiar `FILA_GRID` a:
  `grid grid-cols-[minmax(220px,1.4fr)_150px_130px_minmax(200px,1fr)_56px] gap-4 items-center px-4`
- Alinear `TarifaColumnHeader` al mismo grid (ya lo comparte por `FILA_GRID`).
- Estado: cambiar `<div className="flex justify-end">` a `flex justify-start` para que el badge quede pegado al inicio de su celda, coincidiendo con el header (que también pasará a `text-left`).
- Total USD: ancho `minmax(200px,1fr)` permite que el subtítulo no haga wrap en 1080p.
- Acciones: fijar `56px` (sólo el `⋯`) y ocultar el header "Acciones" (cabecera vacía); los botones de hover migran a aparecer dentro del menú de acciones cuando es necesario, sin reservar columna visible.

### C. Suavizar header de grupo
- Reducir contraste: `bg-muted/15` en vez de `bg-muted/30`, y bajar padding vertical a `py-2`.
- Quitar el `min-w-[150px]` del Badge "Mejor" cuando no aplica (ya está condicional, mantener).

### D. Vigencia más legible
- En `VigenciaBar`: si `progress === 0` (no ha empezado), pintar la barra en `bg-muted-foreground/20` con un dash sutil en lugar de barra vacía, para no parecer un underline roto.
- Subir grosor a `h-1.5` y usar `rounded-full` (ya está).
- Mantener tooltip.

### E. Encabezados sticky dentro del scroll
- El nuevo encabezado único se queda `sticky top-0` dentro del contenedor de la lista para que siga visible al hacer scroll.

## Archivos a tocar

- `src/features/costeo/components/TarifasGroupedView.tsx` — sacar `TarifaColumnHeader` arriba, ajustar paddings del header de grupo.
- `src/features/costeo/components/TarifaFila.tsx` — nuevo `FILA_GRID`, ajustar alineación de Estado, header sin "Acciones".
- `src/features/costeo/components/VigenciaBar.tsx` — track con dash cuando `progress=0`, altura `h-1.5`.

## Validación

1. Playwright en 1920×1080 con filtro Pendientes:
   - Captura `/costeo/tarifas` mostrando 1 cabecera única + 5 grupos sin headers repetidos.
   - Subtítulo de Total en 1 línea.
2. Capturar también en 1366×768 para confirmar que `minmax` no rompe.
3. Bump `APP_VERSION` y `CHANGELOG.md`.

Sin cambios de backend, sin cambios de lógica de aprobación.