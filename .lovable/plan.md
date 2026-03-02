

## Plan: Campos adicionales de ruta y seguro — v3.12.0

### Migración de base de datos

```sql
ALTER TABLE public.cotizaciones ADD COLUMN tiempo_transito_dias integer;
ALTER TABLE public.cotizaciones ADD COLUMN frecuencia text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN ruta_texto text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN validez_propuesta date;
ALTER TABLE public.cotizaciones ADD COLUMN tipo_movimiento text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN seguro boolean NOT NULL DEFAULT false;
ALTER TABLE public.cotizaciones ADD COLUMN valor_seguro_usd numeric NOT NULL DEFAULT 0;
```

### `src/hooks/useCotizaciones.ts`

- Agregar 7 campos nuevos a `CotizacionRow` y `CreateCotizacionInput`
- Incluirlos en el insert de `useCreateCotizacion`

### `src/pages/NuevaCotizacion.tsx`

Agregar estados para los 7 campos nuevos. En la sección **Ruta** (Card existente), agregar debajo de Origen/Destino:

- Tiempo de tránsito (Input numérico, días)
- Frecuencia (Select: Diaria / Semanal / Quincenal)
- Ruta (Input texto, placeholder: "Manzanillo → Los Angeles → Nueva York")
- Validez de la propuesta (DatePicker con Calendar/Popover)
- Tipo de movimiento (Select: CY-CY / CY-DR / DR-DR / DR-CY)
- Seguro (Switch Sí/No)
- Si Sí → Valor del seguro en USD (Input numérico)

El valor del seguro se suma al subtotal de conceptos para el total final. Al pasar `subtotal` al hook, sumar `valor_seguro_usd` si `seguro === true`.

Pasar todos los campos nuevos a `crearCotizacion.mutateAsync()`.

### `src/pages/CotizacionDetalle.tsx`

En la sección "Datos Generales", agregar la visualización de los 7 campos nuevos (tiempo de tránsito, frecuencia, ruta, validez, tipo de movimiento, seguro con valor).

### `src/pages/Changelog.tsx` — Entrada v3.12.0

### Archivos modificados
- `src/hooks/useCotizaciones.ts`
- `src/pages/NuevaCotizacion.tsx`
- `src/pages/CotizacionDetalle.tsx`
- `src/pages/Changelog.tsx`

