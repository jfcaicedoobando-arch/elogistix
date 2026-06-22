## Mejorar tooltip de "Profit MXN proyectado"

Rediseñar el contenido del `TooltipContent` en `ArribosCard.tsx` para que la información se lea como un mini estado de resultados, no como un bloque denso de texto. Sin cambios de lógica ni de datos.

### Cambios visuales

1. **Ancho y respiración**
   - `max-w-xs` → `w-[320px]` con `p-3` para que las dos columnas (label / valor) nunca se compriman.
   - Usar `grid grid-cols-[1fr_auto] gap-x-4 gap-y-1` en cada bloque para alinear todos los montos a la derecha en una sola columna numérica.

2. **Encabezado más claro**
   - Título: "Profit proyectado del mes" en `text-sm font-semibold`.
   - Subtítulo pequeño: "Homologado a MXN" en `text-[10px] text-muted-foreground uppercase tracking-wide`.

3. **Bloque resumen (totales)**
   - Filas Venta / Costo / Profit con jerarquía:
     - Venta y Costo: `text-xs` normal.
     - Profit: fila destacada con fondo sutil (`bg-muted/40 rounded-md px-2 py-1.5`), label en `font-semibold`, monto en `text-base font-bold` con color success/destructive.
   - Mostrar el margen % entre paréntesis junto al profit (calculado: `profit / venta`).

4. **Mini barra de composición Venta vs Costo**
   - Una barra horizontal de 6px (`h-1.5 rounded-full bg-muted`) con dos segmentos: costo (warning) y profit (success/destructive) en proporción.
   - Ayuda a "ver" el margen sin leer los números.

5. **Desglose por moneda origen — como tabla**
   - Convertir las tres filas (USD, EUR, MXN) en una mini-tabla de 3 columnas: `Origen | Venta MXN | Costo MXN`, con header en `text-[10px] uppercase text-muted-foreground` y filas en `tabular-nums text-[11px]`.
   - Ocultar filas con venta y costo en 0 para reducir ruido.

6. **Footer**
   - Mantener la nota "Conversión con TC guardado en cada embarque" en `text-[10px] italic text-muted-foreground` separada por un `border-t`.

### Archivos a tocar

- `src/features/dashboard/components/statusCards/ArribosCard.tsx` — solo el `<TooltipContent>` (líneas 88-124) y un pequeño cálculo de margen %.
- `CHANGELOG.md` — entrada nueva.
- `src/constants/appVersion.ts` — bump a `13.98.5`.

### Verificación

- `bunx vitest run` (no debería romper nada — cambio puramente visual).
- Inspección manual en `/inicio`: pasar el cursor sobre el monto de profit para ver el tooltip rediseñado.
