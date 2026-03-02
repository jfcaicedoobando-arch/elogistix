

## Plan: Tipo de Carga y Descripción de Mercancía — v3.8.0

### Cambios

#### 1. Migración de base de datos

Agregar dos columnas nuevas a `cotizaciones`:

```sql
ALTER TABLE public.cotizaciones ADD COLUMN tipo_carga text NOT NULL DEFAULT 'Carga General';
ALTER TABLE public.cotizaciones ADD COLUMN msds_archivo text;
```

- `tipo_carga`: "Carga General" o "Mercancía Peligrosa"
- `msds_archivo`: ruta en storage del archivo MSDS (solo si es mercancía peligrosa)

#### 2. `src/pages/NuevaCotizacion.tsx`

En la sección Mercancía:

- Agregar dropdown **Tipo de Carga** con dos opciones: "Carga General" y "Mercancía Peligrosa"
- Si se selecciona "Mercancía Peligrosa", mostrar un input de tipo file para subir la hoja de seguridad (MSDS). Se sube al bucket `documentos` en la ruta `cotizaciones/{folio}/msds-{timestamp}.{ext}`
- Reemplazar el `<Input>` de "Descripción de Mercancía" por un `<Select>` con las 9 opciones fijas: Automotriz, Médica, Alimentos, Carga Proyecto, Construcción, Industrial, General, Tecnología, Arte y Moda
- Agregar estados `tipoCarga` y `msdsFile` al componente
- Pasar `tipo_carga` y `msds_archivo` al hook `useCreateCotizacion`

#### 3. `src/hooks/useCotizaciones.ts`

- Agregar `tipo_carga` y `msds_archivo` a `CotizacionRow` y `CreateCotizacionInput`
- Incluir ambos campos en el insert de `useCreateCotizacion`

#### 4. `src/pages/CotizacionDetalle.tsx`

- Mostrar "Tipo de Carga" en la sección Mercancía
- Si tiene `msds_archivo`, mostrar un enlace para descargar/ver el MSDS

#### 5. `src/pages/Changelog.tsx`

- Entrada v3.8.0

### Archivos modificados
- `src/hooks/useCotizaciones.ts` — campos nuevos
- `src/pages/NuevaCotizacion.tsx` — dropdown tipo carga, dropdown descripción, upload MSDS
- `src/pages/CotizacionDetalle.tsx` — mostrar tipo carga y link MSDS
- `src/pages/Changelog.tsx` — v3.8.0

