# RPC Sync Audit — 2026-07-10

Detecta funciones plpgsql que reciben una lista de hijos, insertan nuevos y al final
borran (soft o duro) todo lo que no está en la lista original — sin agregar los ids
recién generados. Es el patrón del bug ELIMP00245.

- **CRITICAL** (3 señales): 0
- **HIGH** (2 señales, revisión manual): 0
- **Live catalog** (funciones vivas con patrón sin `array_append`): 0
- **Filas huérfanas detectadas** (`created_at ≈ deleted_at`): 0

## Migraciones — CRITICAL

_Ninguna._

## Migraciones — HIGH

_Ninguna._

## Catálogo vivo (pg_proc)

_psql no disponible — sección omitida._

## Filas huérfanas

_No inspeccionado._

## Cómo se corrige el patrón

Tras cada `INSERT ... RETURNING id INTO v_new_id`, agregar:

```sql
v_incoming_ids := array_append(v_incoming_ids, v_new_id);
```

Referencia: fix aplicado a `actualizar_embarque_completo` (versión 13.252.2).
