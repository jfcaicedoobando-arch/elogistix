## Diagnóstico

Las 7 suites RLS del CI (`isolation`, `financiero`, `financiero_critico`, `operaciones`, `crm_operacional`, `tarifas_y_costeo`, `roles_no_admin`) fallan todas con el mismo error:

```
psql: ERROR: new row for relation "embarques" violates check constraint "embarques_expediente_formato_valido"
```

**Analogía:** en v13.301.49 le pusimos una cerradura al buzón de expedientes que solo acepta llaves con un formato específico (`ELXXX00001` o `DEMO-YYYY-NNN`). Los fixtures de los tests siguen intentando meter llaves viejas (`EXP-A-001`, `EXP-CRM-B`, etc.) y la cerradura las rechaza antes de siquiera poder probar aislamiento RLS.

El check aplica a filas nuevas (`NOT VALID`), por eso el código productivo y los datos históricos siguen OK, pero los INSERT de los fixtures no.

## Cambio

Reemplazar los expedientes literales en `supabase/tests/rls/*.sql` por valores que sí matchean `^EL[A-Z]{3}[0-9]+$`. Es solo búsqueda-y-reemplazo dentro de esos 7 archivos (y sus WHEREs), sin tocar el esquema ni la lógica de RLS.

| Archivo | De → A |
|---|---|
| `test_rls_isolation.sql` (fixtures + 2 WHEREs) | `EXP-A-001` → `ELISO00001`, `EXP-B-001` → `ELISO00002` |
| `test_rls_financiero.sql` (fixtures + referencia en proforma) | `EXP-FIN-A/B` → `ELFIN00001/2` |
| `test_rls_financiero_critico.sql` | `EXP-FC-A/B` → `ELFCR00001/2` |
| `test_rls_operaciones.sql` | `EXP-OPS-A/B` → `ELOPS00001/2` |
| `test_rls_crm_operacional.sql` | `EXP-CRM-A/B` → `ELCRM00001/2` |
| `test_rls_tarifas_y_costeo.sql` | `EXP-TAR-A/B` → `ELTAR00001/2` |
| `test_rls_roles_no_admin.sql` | `EXP-NA-A/B` → `ELNAD00001/2` |

## Guardarraíl (para que no vuelva a pasar)

Agrego un test de arquitectura ligero: `src/lib/__tests__/rls-fixtures-expediente-format.test.ts` que lee los `supabase/tests/rls/*.sql`, busca literales `expediente` insertados y valida que cada uno cumpla el regex de producción. Si mañana alguien agrega otro fixture con `EXP-XYZ`, CI lo detiene antes de romper la suite RLS.

## Changelog

Nueva entrada `## [13.301.54] - 2026-07-17` documentando la corrección y el nuevo test de arquitectura. Bump de `APP_VERSION` a `13.301.54`.

## Fuera de alcance

- No se toca el CHECK constraint (es correcto: es lo que blinda folios per-org de `v13.301.49`).
- No se corren otras suites (lint/typecheck) porque el cambio es solo SQL de fixtures.
- No se toca ninguna migración de DB.
