## Objetivo
En el listado de Embarques (`/embarques`), por defecto el embarque con el número de expediente más alto debe aparecer primero, con la flecha de orden visible en la columna "Expediente".

## Cambios

1. **`src/hooks/embarque/useEmbarquesPageState.ts`**
   - Cambiar el estado inicial:
     - `sortKey` de `null` → `"expediente"`
     - `sortDir` de `"asc"` → `"desc"`
   - Esto hace que el query server-side ordene por `expediente DESC` desde la primera carga (vía `SORT_KEY_TO_COLUMN`).

2. **`src/services/embarque/queries.ts`** (refuerzo)
   - En `fetchEmbarquesPaginados`, agregar un tiebreaker secundario: cuando `sortBy === 'expediente'`, encadenar `.order('created_at', { ascending: false })` para garantizar orden estable cuando hay expedientes duplicados (caso LCL con un registro por contenedor).

3. **UI**
   - No requiere cambios en `Embarques.tsx`: `controlledSort={{ key: sortKey, dir: sortDir }}` ya pinta la flecha en el header automáticamente.
   - El indicador "Ordenado por Expediente ↓ · global" aparecerá por defecto; el usuario puede quitarlo con "Quitar orden" para volver a `created_at desc`.

4. **Changelog**
   - Agregar entrada patch en `src/content/changelog/v8/chunks/0.ts` y bump de versión patch en `src/constants/appVersion.ts`: "Embarques: orden por defecto por número de expediente descendente".

## Notas técnicas
- El servidor ya soporta `expediente` como columna ordenable (whitelist en `SORTABLE_EMBARQUE_COLUMNS`), no requiere migración.
- El dedupe presencial por expediente sigue funcionando igual; con orden desc por expediente se preserva la primera fila de cada grupo.