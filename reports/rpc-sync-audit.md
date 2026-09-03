# RPC Sync Audit — 2026-09-03

Detecta funciones plpgsql que reciben una lista de hijos, insertan nuevos y al final
borran (soft o duro) todo lo que no está en la lista original — sin agregar los ids
recién generados. Es el patrón del bug ELIMP00245.

- **CRITICAL** (3 señales): 0
- **HIGH** (2 señales, revisión manual): 0
- **Live catalog** (funciones vivas con patrón sin `array_append`): 0
- **Filas huérfanas detectadas** (`created_at ≈ deleted_at`): 12

## Migraciones — CRITICAL

_Ninguna._

## Migraciones — HIGH

_Ninguna._

## Catálogo vivo (pg_proc)

_Sin funciones vivas con el patrón._

## Filas huérfanas

| Tabla | Filas con `created_at ≈ deleted_at` |
|---|---:|
| `conceptos_venta` | 6 |
| `conceptos_costo` | 6 |
| `embarque_contenedores` | 0 |
| `documentos_embarque` | 0 |
| `conceptos_factura` | 0 |

> Un conteo > 0 no garantiza el bug (podría ser un borrado inmediato legítimo), pero es la huella exacta del patrón. Revisar caso por caso antes de rescatar.

## Cómo se corrige el patrón

Tras cada `INSERT ... RETURNING id INTO v_new_id`, agregar:

```sql
v_incoming_ids := array_append(v_incoming_ids, v_new_id);
```

Referencia: fix aplicado a `actualizar_embarque_completo` (versión 13.252.2).
