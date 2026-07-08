## Contexto

Hoy tenemos tres columnas relevantes:

- `proformas.estado_proforma` — `pendiente` | `facturada` (fuente de verdad del ciclo comercial).
- `conceptos_venta.estado_facturacion` — `pendiente` | `en_proforma` | `facturado` (estado por línea).
- `embarques.tiene_proforma` — booleano derivado, ya lo mantiene el trigger `trg_sync_embarque_tiene_proforma`.

**El hueco:** cuando una proforma pasa a `facturada`, sus `conceptos_venta` se quedan en `en_proforma`. Sólo migraciones puntuales los han llevado a `facturado`. Por eso el estado facturado del embarque hoy se **deriva** (JOIN a proformas) en vez de ser un hecho local.

Datos actuales: **463 conceptos** en `en_proforma` cuya proforma ya está `facturada` (deberían ser `facturado`) y **29** ya correctos.

## Cambio

### 1. Migración: trigger + backfill

**a) Trigger `trg_sync_conceptos_venta_facturado` en `proformas`**
- Cuando `estado_proforma` cambia a `facturada` → `UPDATE conceptos_venta SET estado_facturacion='facturado' WHERE proforma_id = NEW.id AND deleted_at IS NULL`.
- Cuando pasa de `facturada` a `pendiente` (rollback) → volver esas líneas a `en_proforma` (siguen ligadas a la proforma).
- Cuando la proforma se soft-borra (`deleted_at`) → conceptos vuelven a `pendiente` y se les limpia `proforma_id` (patrón que ya usa `services/crud.ts` en cliente).
- El trigger corre con `SECURITY DEFINER` + `SET app.auditoria_backfill_legacy='on'` durante su ejecución, para no chocar con `bloquear_conceptos_en_embarque_cerrado` cuando el embarque ya está Cerrado.

**b) Backfill único** para los 463 conceptos ya inconsistentes: reutilizar el mismo path del trigger sobre las proformas facturadas actuales.

### 2. Simplificar la lectura

`src/features/embarques/components/facturacion/estadoConceptoBadge.tsx` y `TabFacturacion.tsx` hoy cruzan `proformas.estado_proforma` para decidir si un concepto está facturado. Después del trigger, `conceptos_venta.estado_facturacion === 'facturado'` es suficiente. Quitar el cross-check (menos código, misma UI).

### 3. Sin cambios en el flujo de creación

`facturar.ts` sigue igual: crea `facturas`, actualiza `proformas`. El trigger se encarga de propagar a `conceptos_venta` automáticamente — el frontend no toca ese campo.

### 4. Nada nuevo en `embarques`

No añadimos `embarques.estado_facturacion` aún. La agregación (total / parcial / ninguno) se sigue calculando desde `conceptos_venta`, que ahora sí es fuente confiable.

## Verificación

Después de correr la migración:

- `SELECT count(*) FROM conceptos_venta cv JOIN proformas p ON p.id=cv.proforma_id WHERE p.estado_proforma='facturada' AND cv.estado_facturacion<>'facturado' AND cv.deleted_at IS NULL;` → debe ser **0**.
- Abrir un embarque cuya proforma esté facturada → badges "Facturado" sin necesidad del JOIN.
- Timbrar una proforma nueva en la app → los conceptos ligados quedan `facturado` sin intervención.

## Registro

Bump de `APP_VERSION` + entrada en `CHANGELOG.md` describiendo el trigger y el backfill.

## Analogía

Hoy, cuando el cliente pregunta "¿ya facturaste esto?", tenemos que ir corriendo al archivero de proformas para comprobarlo. Con este cambio, cada renglón del embarque ya trae el sello "Facturado" pegado. El archivero sigue existiendo, pero ya no hay que abrirlo para responder.
