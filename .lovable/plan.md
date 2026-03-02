

## Plan: Sección de Mercancía Aérea — v3.10.0

### Cambios

#### 1. Migración de base de datos

```sql
ALTER TABLE public.cotizaciones ADD COLUMN dimensiones_aereas jsonb NOT NULL DEFAULT '[]';
```

Almacena array de `{piezas, alto_cm, largo_cm, ancho_cm, peso_volumetrico_kg}`.

#### 2. `src/hooks/useCotizaciones.ts`

- Nueva interfaz `DimensionAerea` con campo `peso_volumetrico_kg` (fórmula: H×L×W×Pcs / 6000)
- Agregar `dimensiones_aereas` a `CotizacionRow` y `CreateCotizacionInput`
- Incluir en el insert de `useCreateCotizacion`

#### 3. Nuevo componente `src/components/cotizacion/SeccionMercanciaAerea.tsx`

Misma estructura visual que `SeccionMercanciaMaritimeLCL` pero con peso volumétrico en lugar de volumen:
- Tipo de carga (dropdown)
- Sector económico (dropdown 9 opciones)
- Descripción adicional (Textarea)
- MSDS condicional
- Tabla dinámica: Piezas, Alto, Largo, Ancho, **Peso volumétrico kg** (auto: H×L×W×Pcs/6000), eliminar
- Totales: Total piezas + Peso volumétrico total kg

#### 4. `src/pages/NuevaCotizacion.tsx`

- Nuevo estado `dimensionesAereas`
- Cuando `modo === 'Aéreo'`, renderizar `SeccionMercanciaAerea` en lugar de `SeccionMercanciaGeneral`
- Calcular totales aéreos para `peso_kg` y `piezas`
- Pasar `dimensiones_aereas` al hook de crear

#### 5. `src/pages/CotizacionDetalle.tsx`

- Cuando modo es Aéreo y tiene dimensiones aéreas, mostrar tabla con peso volumétrico
- Mostrar totales: Total piezas + Peso volumétrico total

#### 6. `src/pages/Changelog.tsx` — Entrada v3.10.0

### Archivos
- `src/hooks/useCotizaciones.ts` — nueva interfaz y campos
- `src/components/cotizacion/SeccionMercanciaAerea.tsx` — nuevo
- `src/pages/NuevaCotizacion.tsx` — renderizar componente aéreo
- `src/pages/CotizacionDetalle.tsx` — visualizar dimensiones aéreas
- `src/pages/Changelog.tsx`

