

## Plan: Campos "Tipo de carga" y "MSDS" en Datos Generales — v3.13.1

### Migración de base de datos

```sql
ALTER TABLE public.embarques
  ADD COLUMN tipo_carga text NOT NULL DEFAULT 'Carga General',
  ADD COLUMN msds_archivo text DEFAULT NULL;
```

### Cambios en código

#### `src/components/embarque/StepDatosGenerales.tsx`
- Agregar props: `tipoCarga`, `setTipoCarga`, `msdsArchivo`, `onMsdsUpload`
- Después de "Descripción de la Mercancía" y antes de "Peso (kg)", agregar:
  - Dropdown "Tipo de carga" con opciones: "Carga General" / "Mercancía Peligrosa"
  - Si `tipoCarga === 'Mercancía Peligrosa'`: mostrar input type="file" para adjuntar MSDS con botón de carga y nombre del archivo si ya existe

#### `src/pages/NuevoEmbarque.tsx`
- Agregar estados: `tipoCarga` (default `'Carga General'`), `msdsArchivo` (default `null`)
- Función `handleMsdsUpload(file)`: sube a Storage en ruta `embarques/msds/{timestamp}_{nombre}` y guarda la ruta en `msdsArchivo`
- Pasar nuevos props a `StepDatosGenerales`
- En `handleFinish`: incluir `tipo_carga` y `msds_archivo` en el objeto `embarque`

#### `src/pages/Changelog.tsx`
- Entrada v3.13.1

### Archivos a modificar
- `src/components/embarque/StepDatosGenerales.tsx`
- `src/pages/NuevoEmbarque.tsx`
- `src/pages/Changelog.tsx`

