## Objetivo

Que al hacer click en un header de la tabla de Embarques, el ordenamiento se aplique sobre **todos los registros del servidor** (no solo la página visible). El orden se manda a Supabase vía `.order()` y se recarga la página actual.

## Alcance

Solo la tabla del módulo **Embarques** (`/embarques`). Otras tablas (Cotizaciones, Clientes, Facturación) quedan igual y se migrarán después si funciona bien.

## Columnas ordenables (server-side)

| Columna UI | Campo DB | Tipo |
|---|---|---|
| Expediente | `expediente` | text |
| Cliente | `cliente_nombre` | text |
| Modo | `modo` | enum |
| Estado | `estado` | enum |
| ETD | `etd` | date |
| ETA | `eta` | date |
| Operador | `operador` | text |
| Creado | `created_at` | timestamp (default actual) |

Las columnas calculadas en cliente (ej. "Liquidación", "Docs faltantes") **no** son ordenables server-side — se mantienen sin sort o con sort local sobre la página visible, marcándolas visualmente distinto.

## Cambios técnicos

### 1. `src/services/embarque/queries.ts`
- Añadir parámetros `sortBy?: string` y `sortDir?: 'asc' | 'desc'` a `EmbarquesPaginadosFilters`.
- Reemplazar el `.order('created_at', { ascending: false })` fijo por:
  ```ts
  const sortCol = f.sortBy ?? 'created_at';
  const sortAsc = (f.sortDir ?? 'desc') === 'asc';
  query = query.order(sortCol, { ascending: sortAsc, nullsFirst: false });
  ```
- Whitelist de columnas permitidas para evitar inyección (validar contra una constante `SORTABLE_COLUMNS`).

### 2. `src/hooks/embarque/useEmbarquesPageState.ts`
- Agregar estado `sortBy` y `sortDir` (default: `created_at` / `desc`).
- Resetear `page` a 0 cuando cambia el sort.

### 3. `src/hooks/embarque/useEmbarqueQueries.ts`
- Pasar `sortBy` y `sortDir` al `queryKey` y al `queryFn` de `useEmbarquesPaginados` para que React Query invalide y refetchee.

### 4. `src/components/shared/DataTable.tsx`
- Soportar modo controlado de sort:
  ```ts
  sortMode?: 'client' | 'server';
  controlledSort?: { key: string; dir: 'asc' | 'desc' } | null;
  onSortChange?: (key: string | null, dir: 'asc' | 'desc') => void;
  ```
- Si `sortMode === 'server'`: NO ordena en memoria, solo dispara `onSortChange` con el ciclo asc → desc → null.
- Default sigue siendo `'client'` para no romper otras tablas.

### 5. Página `src/pages/embarques/Embarques.tsx` (o el componente de tabla que use)
- Pasar `sortMode="server"`, `controlledSort` y `onSortChange` al `DataTable`.
- Marcar las columnas calculadas con `sortable: false` (o un flag visual de "orden local").

### 6. Indicador visual
- Sutil etiqueta arriba de la tabla cuando hay sort activo: `Ordenado por Expediente ↑ · global`.
- Esto deja claro al usuario que el orden aplica sobre los 500 (no solo los 50 visibles).

## Lo que NO se cambia

- Paginación, filtros, búsqueda y debounce siguen igual.
- RLS y permisos no se tocan.
- Otros módulos con `DataTable` mantienen orden client-side (solo cambia el default behavior cuando se opta-in).

## Changelog y versión

- Bump `APP_VERSION` a `v8.104.0` (minor: feature visible al usuario).
- Entrada en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`:
  > **Ordenamiento global en tabla de Embarques**: Al ordenar por columna ahora se aplica sobre todos los registros del servidor, no solo la página visible. Indicador visual confirma el campo y dirección activos.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Performance: `.order()` sobre `cliente_nombre` sin índice puede ser lento con miles de registros | Si se nota lentitud, agregar índice `CREATE INDEX ON embarques (organization_id, cliente_nombre)`. No incluido en este plan — se evalúa después. |
| Cambio de orden recarga toda la página actual | Comportamiento esperado y correcto; el spinner del refetch ya existe. |
| Romper otras tablas que usan `DataTable` | El flag `sortMode` es opt-in; default sigue siendo client. |

## Validación post-implementación

1. Ordenar por Expediente asc/desc → verificar que los expedientes en la página 1 sean los primeros del dataset completo.
2. Cambiar de página → el orden persiste.
3. Aplicar filtro + sort → ambos se aplican en el server.
4. Click 3 veces en una columna → vuelve al orden default (`created_at desc`).
