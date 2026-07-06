## Contexto

Segundo lote del backfill de gap operativo: 5 proformas más facturadas fuera del ERP que hay que mover a `facturada` sin factura vinculada.

## Folios a mover (5)

Todos existen en Elogistix, en `pendiente/borrador`, `estado_cliente='aceptada'`, sin `factura_id` ni `folio_factura_externa`:

| Folio | estado_revision actual |
|---|---|
| PRO-2026-0297 | aprobada |
| PRO-2026-0322 | pendiente |
| PRO-2026-0337 | pendiente |
| PRO-2026-0340 | pendiente |
| PRO-2026-0948 | pendiente |

## Cambios

```text
estado_proforma   : pendiente → facturada
estado_aprobacion : borrador  → 'aprobada'   ← forzado para los 5
origen            : NULL      → 'gap_externo'
fecha_facturacion : (si NULL) → now()
updated_at        : now()
```

Diferencia respecto al lote anterior: en el lote 1 copiamos `estado_aprobacion = estado_revision` porque todos tenían valor válido (consolidada/aprobada). En este lote 4 de 5 están en `estado_revision='pendiente'` y por decisión operativa quedan como `estado_aprobacion='aprobada'` (la facturación externa implica aprobación tácita). No se toca `estado_revision`.

No se modifica: `factura_id`, `folio_factura_externa`, montos, cliente, ni ningún otro campo.

## Trazabilidad y respaldo

- Respaldo previo en tabla `public._backup_gap_externo_proformas_20260706_lote2` (copia completa de las 5 filas).
- `origen='gap_externo'` es el mismo valor del lote anterior — así ambos lotes se reportan juntos como "facturado fuera del ERP durante el gap".

## Sección técnica

- Sin migración de esquema.
- Una sola llamada al tool de escritura: `CREATE TABLE ... AS SELECT` para backup + `UPDATE` con `numero IN (...)` **y** `organization_id='00000000-0000-0000-0000-000000000001'` (defensa en profundidad).
- Reversión: `UPDATE proformas FROM _backup_gap_externo_proformas_20260706_lote2 ...`.
- CHANGELOG + bump `APP_VERSION` a `13.199.2` (patch — sigue siendo limpieza operativa).
