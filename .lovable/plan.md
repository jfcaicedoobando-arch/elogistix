## Objetivo

Al cargar la tabla de Embarques y al ordenar por la columna **Expediente**, el orden debe basarse en el **consecutivo numérico** (la parte numérica final del expediente), ignorando el prefijo (ELNAC, ELIMP, DEMO-…, etc.). Orden por defecto: **descendente** (más reciente arriba).

### Ejemplo
Hoy (alfabético): `ELIMP00271`, `ELIMP00270`, `DEMO-2026-004`, `DEMO-2026-003`, `ELIMP00269`…
Después (numérico): `ELIMP00271`, `ELIMP00270`, `ELIMP00269`, …, `DEMO-2026-004`, `DEMO-2026-003`… (el número manda; los empates conservan orden por `created_at desc`).

## Cambios

### 1. Backend — RPC `embarques_listado`
Nueva migración que reemplaza el ORDER BY dinámico para reconocer la pseudo-columna `expediente_num`:

- Agregar `'expediente_num'` al whitelist (y dejar `'expediente'` como alias del mismo comportamiento numérico, ya que el UI sólo expone una columna "Expediente").
- Cuando `v_sort IN ('expediente','expediente_num')`, el `ORDER BY` usa:
  `NULLIF(regexp_replace(expediente, '\D', '', 'g'), '')::bigint <dir> NULLS LAST, expediente <dir>, created_at DESC`
  (el segundo criterio desempata expedientes con el mismo número pero distinto prefijo).
- Para las demás columnas se mantiene el `%I` actual.
- Cambiar `p_sort_by` DEFAULT a `'expediente_num'`.

### 2. Cliente
- `services/queries/paginados.ts`: agregar `'expediente_num'` a `SORTABLE_EMBARQUE_COLUMNS`; cambiar el fallback de `created_at` → `expediente_num`; mapear UI key `expediente` → `expediente_num` en `SORT_KEY_TO_COLUMN`.
- `services/queries/exportListado.ts`: cambiar el `sortBy: "created_at"` por `"expediente_num"` para que el export siga el mismo orden visible.
- `components/embarqueColumns.tsx`: cambiar el `sortingFn` de la columna Expediente por uno numérico (extrae dígitos con regex y compara como número; desempate por string completo) para que la ordenación client-side (rama con filtro de estado) coincida con la del servidor.
- `domain/embarquesPageHelpers.ts`: actualizar `SORT_GETTERS.expediente` para devolver el número (`Number(expediente.replace(/\D/g,'')) || 0`) para mantener consistencia en `compareBy`.
- `services/queries/__tests__/listado.test.ts`: ajustar el test de fallback (`'invalid_col' → 'expediente_num'`).

### 3. Versionado
- `APP_VERSION` → `13.42.0`.
- Entrada en `CHANGELOG.md`:
  > Embarques: orden por defecto y al ordenar por columna Expediente ahora usa el consecutivo numérico ignorando el prefijo (ELNAC, ELIMP, DEMO-…).

## Fuera de alcance
- No se altera el formato de generación de expedientes ni la columna almacenada.
- No se tocan otros listados (cotizaciones, facturas, proformas).
- No se agrega una segunda columna "Consecutivo"; se mantiene una sola columna Expediente con el orden numérico.
