# Auditoría: detectar bugs tipo "auto-borrado" en RPCs

## Contexto

El bug de ELIMP00245 no fue un typo: fue un **patrón peligroso** repetido. La receta del error es siempre igual:

1. Un RPC recibe un payload con una lista de hijos (conceptos, documentos, contactos, líneas, etc.).
2. Al inicio arma un array `v_incoming_ids` con los `id` que vienen en el payload.
3. Recorre el payload haciendo `UPDATE` a los existentes e `INSERT` a los nuevos (que generan un id fresco).
4. Al final hace un soft-delete o `DELETE` con `WHERE NOT (id = ANY(v_incoming_ids))`.
5. Los recién insertados nunca se agregan a `v_incoming_ids` → se auto-borran.

Analogía: la lista de invitados se cierra antes de que lleguen los invitados nuevos, así que el guardia los echa apenas entran. Este mismo patrón puede estar en cualquier RPC que "sincronice" una tabla hija desde un payload.

## Alcance de la auditoría

Sólo lectura. No modifica código. Produce un reporte en `reports/rpc-sync-audit.md` con findings clasificados por severidad.

## Qué revisa el auditor

### A. Escaneo estático de migraciones SQL

Recorre `supabase/migrations/**/*.sql` buscando funciones (`CREATE OR REPLACE FUNCTION`) que combinen las tres señales del patrón:

- **Señal 1 — Captura previa de ids**: declaración de un array (`uuid[]`, `bigint[]`) tipo `v_incoming_*`, `v_keep_*`, `v_existing_*`, poblado con `array_agg(...->>'id')` o `SELECT array_agg` sobre el payload JSON antes del loop.
- **Señal 2 — Insert con id nuevo**: dentro del cuerpo aparece `INSERT INTO ... RETURNING id INTO v_new_id` (o equivalente) sin un `array_append(v_incoming_*, v_new_id)` inmediatamente después.
- **Señal 3 — Borrado por complemento**: `UPDATE ... SET deleted_at = now() WHERE ... NOT (id = ANY(v_incoming_*))` o `DELETE FROM ... WHERE ... NOT IN (...)`.

Una función que cumple las 3 señales = **CRITICAL**. Cumple 2 = **HIGH** (revisión manual). Cumple 1 = ignorar.

### B. Escaneo del catálogo vivo

Usa `supabase--read_query` sobre `pg_proc` para listar funciones `SECURITY DEFINER` en `public` cuyo cuerpo (`prosrc`) contenga a la vez `array_agg` + `RETURNING id` + (`deleted_at = now()` o `DELETE FROM`). Esto captura funciones que existen en producción aunque su migración original ya no sea legible (parches sucesivos).

### C. Contraste con datos

Para cada función sospechosa, query de verificación sobre las tablas hijas que toca:

```sql
SELECT count(*) FROM <tabla_hija>
WHERE deleted_at IS NOT NULL
  AND deleted_at - created_at < interval '1 second';
```

`created_at ≈ deleted_at` = huella exacta del bug. Si el conteo > 0, el finding sube a **CONFIRMED** y el reporte lista los `id` afectados para posible rescate.

### D. Canario de regresión (pgtap)

Propone (no crea) un test genérico en `supabase/tests/rls/` que para cada RPC de sincronización:
1. Cree una fila padre.
2. Llame al RPC con un hijo sin `id`.
3. Verifique `deleted_at IS NULL` en el hijo recién creado.

Este canario, una vez añadido, evita que el patrón vuelva por descuido.

## Entregable

`reports/rpc-sync-audit.md` con:

- Tabla de funciones auditadas (nombre, archivo, señales detectadas, severidad).
- Sección **CONFIRMED** con filas huérfanas por tabla + snippets SQL de rescate.
- Sección **HIGH** con funciones a revisar manualmente y por qué el heurístico no está 100% seguro.
- Recomendación de patrón correcto (append al array tras cada INSERT) con un ejemplo tomado del fix de `actualizar_embarque_completo`.

## Fuera de alcance

- No modifica RPCs (eso se decide después, viendo el reporte).
- No restaura datos automáticamente (cada rescate se aprueba caso por caso).
- No cubre bugs de concurrencia/locking; sólo el patrón de "lista cerrada antes de tiempo".

## Detalles técnicos

- Script nuevo: `scripts/audit-rpc-sync.ts` (CLI, sólo lectura). Reutiliza `scripts/lib/walk.ts` para recorrer migraciones.
- Sin dependencias nuevas; regex + parseo ligero.
- Corre local con `bun run audit:rpc-sync`. Opcional: agregar job en `.github/workflows` para que corra semanal (cron) — decidible después de ver el ruido.

## Resumen para el usuario

Igual que tenemos `audit:arch` y `audit:casts` que revisan estructura y tipos, este añadiría `audit:rpc-sync` que revisa una **receta específica de bug de base de datos**: RPCs que reciben una lista de hijos, insertan los nuevos, y al final borran "todo lo que no está en la lista" — olvidando que los recién creados tampoco están. El auditor busca esa receta en todas las migraciones y funciones vivas, y contrasta con datos reales (`created_at ≈ deleted_at`) para decir no sólo "esto se ve raro" sino "aquí hay 3 filas ya afectadas". El resultado es un reporte, no un cambio: tú decides qué parchar.
