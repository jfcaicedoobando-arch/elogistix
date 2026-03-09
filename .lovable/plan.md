

## Actualizar sistema de estados de embarques (v4.32.0)

### PASO 1 — Migración SQL

Agregar `Arribo` y `EIR` al enum `estado_embarque`. Limpiar datos existentes y cambiar default.

```sql
ALTER TYPE public.estado_embarque ADD VALUE IF NOT EXISTS 'Arribo';
ALTER TYPE public.estado_embarque ADD VALUE IF NOT EXISTS 'EIR';
UPDATE public.embarques SET estado = 'Confirmado' WHERE estado IN ('Cotización', 'Borrador');
ALTER TABLE public.embarques ALTER COLUMN estado SET DEFAULT 'Confirmado';
```

### PASO 2 — `src/hooks/useEmbarqueUtils.ts`

Actualizar firma de `calcularEstadoEmbarque` agregando parámetro `tipo: string`. Estados manuales: `['Arribo', 'En Aduana', 'Entregado', 'EIR', 'Cerrado']`. Solo calcula automático si `modo === 'Marítimo' && tipo === 'Importación'`. Post-ETA devuelve `'Arribo'` en vez de `'En Aduana'`.

### PASO 3 — Actualizar todos los call sites (nuevo parámetro `tipo`)

| Archivo | Cambio |
|---|---|
| `src/pages/Embarques.tsx` (líneas 45, 71) | Agregar `e.tipo` como segundo argumento |
| `src/pages/EmbarqueDetalle.tsx` (línea 61) | Agregar `embarque.tipo` |
| `src/hooks/useDashboardData.ts` (línea 83) | Agregar `e.tipo` |
| `src/pages/Reportes.tsx` (líneas 87, 112-118, 126-141) | Actualizar usos y filtro de demoras a estado `'Arribo'` |

### PASO 4 — `src/data/embarqueConstants.ts`

```typescript
export const ESTADO_TIMELINE = ['Confirmado', 'En Tránsito', 'Arribo', 'En Aduana', 'Entregado', 'EIR', 'Cerrado'] as const;
export const ESTADOS_EMBARQUE = ['Confirmado', 'En Tránsito', 'Arribo', 'En Aduana', 'Entregado', 'EIR', 'Cerrado'] as const;
export const ESTADOS_ACTIVOS = ['Confirmado', 'En Tránsito', 'Arribo', 'En Aduana', 'Entregado'] as const;
export const ESTADOS_INACTIVOS = ['EIR', 'Cerrado'] as const;
```

### PASO 5 — Colores

**`src/lib/helpers.ts`** — `getEstadoColor()`:
- Arribo: `bg-cyan-500/15 text-cyan-600`
- En Aduana: `bg-violet-500/15 text-violet-600`
- EIR: `bg-orange-500/15 text-orange-600`
- Entregado: `bg-emerald-500/15 text-emerald-600`
- Cerrado: `bg-muted text-muted-foreground`

**`src/components/dashboard/estadoConfig.ts`** — Agregar `Arribo` y `EIR` al `ESTADO_CONFIG`. Actualizar tipo `EstadoFiltro` (viene de `useDashboardData`).

### PASO 6 — `src/hooks/useDashboardData.ts`

- `conteoPorEstado`: agregar Arribo y EIR
- `alertasDemora`: filtrar por `estadoReal === 'Arribo'` en vez de `'En Aduana'`
- Actualizar `activos` filter para excluir `['EIR', 'Cerrado', 'Cancelado']`

### PASO 7 — Tests y Changelog

- `src/data/__tests__/embarqueConstants.test.ts`: actualizar assertions (7 estados en timeline)
- `src/pages/Changelog.tsx`: entrada v4.32.0

### Archivos a modificar (9)

1. Migración SQL (nueva)
2. `src/hooks/useEmbarqueUtils.ts`
3. `src/data/embarqueConstants.ts`
4. `src/lib/helpers.ts`
5. `src/components/dashboard/estadoConfig.ts`
6. `src/hooks/useDashboardData.ts`
7. `src/pages/Embarques.tsx`
8. `src/pages/EmbarqueDetalle.tsx`
9. `src/pages/Reportes.tsx`
10. `src/data/__tests__/embarqueConstants.test.ts`
11. `src/pages/Changelog.tsx`

