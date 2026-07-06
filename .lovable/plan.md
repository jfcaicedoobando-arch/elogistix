
## Contexto

Durante un gap operativo, Elogistix trabajó fuera del ERP y algunas proformas "Aceptadas" se facturaron por otro sistema. Vamos a moverlas a `facturada` sin factura vinculada, marcándolas con `origen='gap_externo'` para no confundirlas con facturas reales ni con el legado del ERP viejo.

## Folios a mover (11)

Los 11 existen en Elogistix y están todos en `pendiente/borrador` con cliente `aceptada` y sin factura ni folio externo:

| Grupo | Folios | estado_revision |
|---|---|---|
| A | 0291, 0292, 0293, 0294, 0295 | consolidada |
| B | 0296, 0299, 0318, 0325, 0332, 0336 | aprobada |

## Cambios que se aplicarán

Para los 11 folios:

```text
estado_proforma   : pendiente  → facturada
estado_aprobacion : borrador   → estado_revision (consolidada o aprobada)
origen            : NULL       → 'gap_externo'
fecha_facturacion : (si es NULL) → now()   ← para que aparezcan en reportes del periodo
updated_at        : now()
```

No se toca `factura_id`, `folio_factura_externa`, montos, cliente, ni ningún otro campo.

## Trazabilidad y respaldo

1. **Respaldo previo**: tabla `public._backup_gap_externo_proformas_20260706` con copia completa de las 11 filas antes de tocarlas (mismo patrón que el backfill anterior).
2. **Nuevo valor `gap_externo`** convive con `legacy_erp` en la columna `origen`. Quedan 3 estados de origen posibles:
   - `NULL` → creada normalmente dentro del sistema.
   - `legacy_erp` → importada del ERP viejo sin evidencia.
   - `gap_externo` → facturada fuera del sistema durante el periodo sin ERP.

## Sección técnica

- No requiere migración de esquema (la columna `origen` ya existe desde el backfill anterior).
- Todo va en una sola llamada al tool de escritura de datos: `CREATE TABLE ... AS SELECT` para respaldo + `UPDATE` sobre los 11 folios filtrando por `numero IN (...)` **y** `organization_id` de Elogistix (defensa en profundidad).
- Reversión: `UPDATE proformas ... FROM _backup_gap_externo_proformas_20260706 ...` restaura estado exacto.
- CHANGELOG + bump de `APP_VERSION` a `13.199.1` (patch — es limpieza operativa, no feature).
