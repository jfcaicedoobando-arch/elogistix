## Diagnóstico

El backfill falla porque las funciones SQL referencian columnas y valores de enum que no existen en la BD real:

**1. `backfill_proformas_aceptadas` — rompe primero (column does not exist)**
- Usa `p.estado` → la columna real es `p.estado_proforma`.
- Filtra por `('borrador','enviada','aceptada')` → valores reales son `'pendiente'`, `'facturada'`.
- Setea `estado = 'facturada'` → debe ser `estado_proforma = 'facturada'`.

**2. `backfill_conceptos_venta_facturados` — fallaría después**
- Filtra `facturas.estado IN ('emitida','pagada','parcial','timbrada')` en minúsculas.
- El enum `estado_factura` real es: `'Borrador','Emitida','Pagada','Vencida','Cancelada','Parcialmente pagada'` (capitalizado, sin `'parcial'` ni `'timbrada'`).

Esto explica el error al ejecutar y también por qué la regla `ventas_sin_facturar` siguió dando falsos positivos en embarques viejos: el backfill nunca matcheó nada.

## Cambios

Una sola migración SQL que reemplaza ambas funciones con los nombres/valores correctos:

```text
backfill_conceptos_venta_facturados()
  - facturas.estado IN ('Emitida','Pagada','Parcialmente pagada')
  - (sin cambios en lógica de UPDATE)

backfill_proformas_aceptadas()
  - WHERE p.estado_proforma = 'pendiente'
  - AND EXISTS (factura con estado IN ('Emitida','Pagada','Parcialmente pagada'))
  - SET estado_proforma = 'facturada'
```

`run_auditoria_backfill_legacy()` no cambia — sigue orquestando las dos.

## Validación

1. Antes de ejecutar en prod, query de conteo:
   - `SELECT COUNT(*) FROM conceptos_venta cv JOIN embarques e ON e.id=cv.embarque_id WHERE cv.estado_facturacion='pendiente' AND e.estado IN ('Entregado','Cerrado') AND EXISTS (SELECT 1 FROM facturas f WHERE f.embarque_id=cv.embarque_id AND f.estado IN ('Emitida','Pagada','Parcialmente pagada'));`
   - Mismo para proformas.
2. Ejecutar el botón en `/admin/auditoria` — debe devolver totales > 0 y eliminar los falsos positivos en expediente 00062.

## Fuera de alcance

- Backfill de `docs_pendientes_avanzado` / `fechas` (requieren intervención humana).
- Cambios en la UI (`BackfillLegacyCard`) — el contrato JSON de respuesta no cambia.
- `CHANGELOG.md` + bump `APP_VERSION` patch (`13.22.1`) post-implementación.
