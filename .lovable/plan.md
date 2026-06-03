## Bug

El triángulo amarillo de "docs pendientes" en la lista de embarques cuenta los documentos marcados como **"No aplica"** como si estuvieran pendientes. La RPC `public.embarques_list_extras` usa el filtro:

```sql
count(*) FILTER (WHERE d.estado NOT IN ('Recibido', 'Validado')) AS pendientes
```

Eso incluye `'No aplica'` (168 docs en BD así marcados) → falsos positivos en el listado.

## Fix

Reemplazar la función con el mismo criterio que usa auditoría: un documento está **satisfecho** si tiene archivo subido **o** está marcado como "No aplica". Por lo tanto pendiente =

```sql
d.archivo IS NULL AND d.estado <> 'No aplica'
```

## Verificación post-fix (esperado)

| Expediente | Antes | Después |
|------------|------:|--------:|
| ELIMP00108 | 6 | 0 |
| ELIMP00058 | 6 | 0 |
| ELIMP00102 | 4 | 4 |

## Archivos

- Nueva migración: `CREATE OR REPLACE FUNCTION public.embarques_list_extras` con el filtro corregido (mantengo la firma, `SECURITY DEFINER`, `search_path = public`).
- `CHANGELOG.md` → entrada `12.51.10`.
- `src/constants/appVersion.ts` → bump a `12.51.10`.

## Fuera de alcance

- Frontend (`embarqueColumns.tsx`, `useEmbarquesPageController`) no requiere cambios: ya pinta `docInfo.pendientes`.
- El tooltip y badge de "Datos pendientes" (BL Master / contenedores incompletos) es otro indicador distinto y queda igual.
