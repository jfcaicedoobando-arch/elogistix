

## Plan: Mercancía dinámica FCL/LCL para carga marítima — v3.9.0

### Alcance

Reemplazar la sección actual de Mercancía en `NuevaCotizacion.tsx` con un comportamiento dinámico condicionado al modo de transporte (Marítimo) y tipo de embarque (FCL/LCL). Para modos no marítimos, mantener los campos actuales. Agregar nuevas columnas a la tabla `cotizaciones` para persistir los datos nuevos.

### 1. Migración de base de datos

```sql
ALTER TABLE public.cotizaciones ADD COLUMN tipo_embarque text NOT NULL DEFAULT 'FCL';
ALTER TABLE public.cotizaciones ADD COLUMN tipo_contenedor text;
ALTER TABLE public.cotizaciones ADD COLUMN tipo_peso text NOT NULL DEFAULT 'Peso Normal';
ALTER TABLE public.cotizaciones ADD COLUMN descripcion_adicional text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN sector_economico text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN dimensiones_lcl jsonb NOT NULL DEFAULT '[]';
```

- `tipo_embarque`: "FCL" o "LCL" (solo para marítimo)
- `tipo_contenedor`: tipo de contenedor seleccionado (solo FCL)
- `tipo_peso`: "Peso Normal" o "Sobrepeso" (solo FCL)
- `descripcion_adicional`: texto libre multilínea
- `sector_economico`: reemplaza el actual `descripcion_mercancia` en la UI (mismo catálogo de 9 opciones)
- `dimensiones_lcl`: array JSONB de `{piezas, alto_cm, largo_cm, ancho_cm, volumen_m3}`

### 2. `src/hooks/useCotizaciones.ts`

- Agregar los 6 campos nuevos a `CotizacionRow` y `CreateCotizacionInput`
- Incluirlos en el insert de `useCreateCotizacion`
- Pasar `tipo_contenedor` y dimensiones al crear embarque en `useCrearEmbarqueDesdeCotizacion`

### 3. `src/pages/NuevaCotizacion.tsx` — Sección Mercancía

Agregar estado `tipoEmbarque` ("FCL"/"LCL"), visible solo cuando `modo === 'Marítimo'`.

**Cuando modo es Marítimo**, reemplazar toda la sección Mercancía con:

- Selector FCL/LCL (radio buttons o Select)

**FCL muestra:**
1. Tipo de contenedor (Select con 10 opciones especificadas)
2. Tipo de carga (Carga General / Mercancía Peligrosa)
3. Sector económico (dropdown 9 opciones)
4. Descripción adicional (Textarea)
5. Peso (Peso Normal / Sobrepeso)
6. Si Mercancía Peligrosa → campo subir MSDS

**LCL muestra:**
1. Tipo de carga (Carga General / Mercancía Peligrosa)
2. Sector económico (dropdown 9 opciones)
3. Descripción adicional (Textarea)
4. Si Mercancía Peligrosa → campo subir MSDS
5. Tabla dinámica de dimensiones: Piezas, Alto (cm), Largo (cm), Ancho (cm), Volumen m³ (auto), botón eliminar
6. Botón "+ Agregar medidas"
7. Totales: Total piezas, Volumen total m³

**Cuando modo NO es Marítimo:** mantener campos actuales (tipo carga, sector, descripción adicional, peso, volumen, piezas).

Al cambiar entre FCL y LCL se resetean los campos del modo anterior.

### 4. `src/pages/CotizacionDetalle.tsx` — Sección Mercancía

- Mostrar Tipo de Embarque (FCL/LCL) si modo es Marítimo
- Mostrar Tipo de Contenedor y Tipo de Peso si FCL
- Mostrar Sector Económico y Descripción Adicional
- Si LCL y tiene dimensiones, mostrar tabla de dimensiones con totales
- Mantener MSDS link existente

### 5. `src/pages/Changelog.tsx`

- Entrada v3.9.0

### Archivos modificados
- `src/hooks/useCotizaciones.ts` — campos nuevos en tipos e insert
- `src/pages/NuevaCotizacion.tsx` — sección Mercancía dinámica FCL/LCL
- `src/pages/CotizacionDetalle.tsx` — visualización de nuevos campos
- `src/pages/Changelog.tsx` — v3.9.0

### Detalle técnico: Contenedores FCL

Solo se muestran estos 10 tipos (subset del catálogo `containerTypes.ts`):
```
20' Dry, 40' Dry, 40' High Cube, 45' High Cube,
20' Reefer, 40' Reefer, 20' Open Top, 40' Open Top,
20' Flat Rack, 40' Flat Rack
```

### Detalle técnico: Dimensiones LCL

Interfaz para cada fila:
```typescript
interface DimensionLCL {
  piezas: number;
  alto_cm: number;
  largo_cm: number;
  ancho_cm: number;
  volumen_m3: number; // (alto * largo * ancho * piezas) / 1_000_000
}
```

Se almacenan como JSONB en `dimensiones_lcl`. Los totales de piezas y volumen se calculan sumando todas las filas y se guardan en `piezas` y `volumen_m3` de la cotización.

