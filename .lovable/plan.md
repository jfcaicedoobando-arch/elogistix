## Diagnóstico

No, para F1 el backfill **no se ejecutó** porque la cancelación de F1 (`aa72d0e7-…`) ocurrió minutos antes del despliegue del nuevo bloque en `facturapi-cancelar`. La proforma origen quedó en un estado inconsistente:

| Proforma | estado_proforma | factura_id | factura_secundaria_id | fecha_facturacion |
|---|---|---|---|---|
| PRO-2026-0952 | `facturada` | `NULL` | `NULL` | `2026-07-06` |

## Cambio

Corrección puntual (data-fix) sobre la proforma origen de F1:

```sql
UPDATE public.proformas
   SET estado_proforma       = 'pendiente',
       fecha_facturacion     = NULL,
       folio_factura_externa = NULL,
       updated_at            = now()
 WHERE id = '7e006811-ae32-4862-abbe-a1f8ce6c6327';
```

Con esto, `PRO-2026-0952` vuelve a aparecer en la bandeja de proformas lista para volver a facturarse (mismo comportamiento que el nuevo edge function ya hace automáticamente para futuras cancelaciones).

## Fuera de alcance

- Existen ~80 proformas más con la misma forma `estado_proforma='facturada'` + ambos `factura_id` en `NULL`, pero **la mayoría son casos legacy** migrados con `folio_factura_externa` desde el ERP viejo, no cancelaciones. No se tocan en este data-fix; si más adelante se detectan otras F# canceladas que no revirtieron su proforma, se aplicaría el mismo patrón caso por caso.
- No hay cambios de código, sólo un `INSERT`/`UPDATE` a datos.
