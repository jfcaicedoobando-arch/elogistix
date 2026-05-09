## Objetivo
En la tarjeta "Embarques Relacionados" del detalle de embarque, reemplazar la columna "Cliente" por una columna "Contenedor" que muestre el número de contenedor de cada embarque relacionado.

## Cambios

1. **`src/services/embarque/queries.ts`** (línea 255)
   - En `fetchEmbarquesRelacionados`, cambiar el `select` para traer `contenedor` y `tipo_contenedor` en lugar de `cliente_nombre`:
     `'id, expediente, bl_house, contenedor, tipo_contenedor, shipper, estado'`.

2. **`src/components/embarque/TabResumen.tsx`** (línea 121)
   - Reemplazar la columna `cliente`:
     ```
     { key: "contenedor", header: "Contenedor", className: "text-xs",
       render: (r: RelacionadoRow) => r.contenedor
         ? `${r.contenedor}${r.tipo_contenedor ? ` (${r.tipo_contenedor})` : ''}`
         : '-' },
     ```
   - Mantener el resto de columnas (Expediente, BL House, Shipper, Estado) sin cambios.

3. **Changelog + bump patch**
   - `src/constants/appVersion.ts`: 8.129.1 → 8.129.2.
   - Nueva entrada patch en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`: "Embarques Relacionados: columna Cliente reemplazada por Contenedor".

## Notas técnicas
- El tipo `RelacionadoRow` se infiere automáticamente del hook, así que ajustar el `select` propaga los nuevos campos sin tocar tipos manuales.
- Useful para LCL/agrupaciones por BL Master donde lo relevante es distinguir por contenedor, no por cliente (que suele repetirse).