

## Plan: Estado automático para embarques marítimos

### Problema detectado: enum `estado_embarque` incompleto

El enum actual solo tiene: `Cotización`, `Confirmado`, `En Tránsito`, `Llegada`, `En Proceso`, `Cerrado`.

La función `calcularEstadoEmbarque` necesita `En Aduana`, `Entregado` y `Cancelado` que no existen. Se requiere migración SQL para agregar estos valores al enum.

### Cambios

**1. Migración SQL** — Agregar valores al enum + limpiar datos

```sql
ALTER TYPE public.estado_embarque ADD VALUE IF NOT EXISTS 'En Aduana';
ALTER TYPE public.estado_embarque ADD VALUE IF NOT EXISTS 'Entregado';
ALTER TYPE public.estado_embarque ADD VALUE IF NOT EXISTS 'Cancelado';

UPDATE public.embarques SET estado = 'Confirmado' WHERE estado = 'Cotización';
```

**2. `src/hooks/useEmbarques.ts`** — Agregar función helper + cambiar estado en duplicar

- Exportar `calcularEstadoEmbarque(modo, etd, eta, estadoActual)` exactamente como lo describe el usuario
- En `useDuplicarEmbarque`: cambiar `estado: 'Cotización'` → `estado: 'Confirmado'`

**3. `src/pages/EmbarqueDetalle.tsx`** — useEffect para auto-actualizar estado

- Importar `calcularEstadoEmbarque` y `useQueryClient`
- Agregar useEffect que al cargar embarque calcule estado y actualice DB si difiere

**4. `src/pages/Embarques.tsx`** — Mostrar estado calculado en lista

- Importar `calcularEstadoEmbarque`
- En el render de cada fila, usar `calcularEstadoEmbarque(embarque.modo, embarque.etd, embarque.eta, embarque.estado)` para el badge

**5. `src/hooks/useCotizaciones.ts`** — Convertir cotización crea con estado `Confirmado`

- En `useConvertirCotizacionAEmbarques`, agregar `estado: 'Confirmado' as any` al insert (~línea 393-408)

**6. `src/data/embarqueConstants.ts`** — Actualizar `ESTADO_TIMELINE`

Agregar los nuevos estados: `['Confirmado', 'En Tránsito', 'En Aduana', 'Llegada', 'En Proceso', 'Entregado', 'Cerrado']`
(Eliminar 'Cotización' del timeline)

**7. `src/lib/helpers.ts`** — Agregar colores para nuevos estados

- `'En Aduana'`: color tipo warning/accent
- `'Entregado'`: color success
- `'Cancelado'`: color destructive

**8. `src/data/types.ts`** — Sin cambios (se regenera automáticamente desde el enum)

**9. `src/pages/Changelog.tsx`** — Entrada v4.15.4

