

## Corregir estado de cotización al generar embarques

### Paso 1 — Migración SQL
Agregar valor `'Embarcada'` al enum `estado_cotizacion`:
```sql
ALTER TYPE estado_cotizacion ADD VALUE IF NOT EXISTS 'Embarcada';
```

### Paso 2 — `src/hooks/useCotizaciones.ts`
En `useConvertirCotizacionAEmbarques`, línea ~261, cambiar `'Convertida'` por `'Embarcada'`.

### Paso 3 — `src/pages/Cotizaciones.tsx`
Línea 24: agregar `'Embarcada'` al array `ESTADOS`.

### Paso 4 — `src/lib/helpers.ts`
Agregar color para `'Embarcada'` en `getEstadoColor`: `'bg-indigo-500/15 text-indigo-600'`.

### Paso 5 — `src/pages/CotizacionDetalle.tsx`
- El badge ya usa `getEstadoColor`, así que mostrará el color indigo automáticamente.
- Línea 169: cambiar condición del botón "Generar Embarques" de `esAceptada` a `esAceptada && cotizacion.estado !== 'Embarcada'` (o simplemente mantener `esAceptada` ya que `esAceptada` es `estado === 'Aceptada'`, que ya excluye `'Embarcada'`). No se necesita cambio adicional porque `esAceptada` ya filtra correctamente.

### Paso 6 — Changelog
Agregar entrada v4.36.3 describiendo el cambio.

4 archivos editados, 1 migración SQL.

