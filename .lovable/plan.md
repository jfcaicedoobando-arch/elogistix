# Conciliación masiva de conceptos legacy → facturado

## Objetivo
Correr **una sola vez** una conciliación que marque como `facturado` los conceptos de venta pendientes de embarques legacy que ya cuentan con proformas facturadas y/o facturas, y liguen `proforma_id` cuando sea posible.

## Reglas de conciliación

### Alcance
- Estados de embarque incluidos: `EIR`, `Arribo`, `En Tránsito`, `Entregado`, `Cerrado` (todos los operativos; se excluyen `Borrador`/`Cotización`/`Cancelado`).
- Sólo conceptos con `estado_facturacion = 'pendiente'`.

### Evidencia (basta con una)
- **A) Factura interna**: existe `facturas` con `embarque_id = e.id` y `estado IN ('Emitida','Pagada','Parcialmente pagada')`.
- **B) Proforma facturada**: existe `proformas` con `embarque_id = e.id` y `estado_proforma = 'facturada'`.

### Ligado de `proforma_id` (matching automático)
Para cada concepto pendiente del embarque, buscar en `proforma_conceptos_consolidados` de las proformas del embarque un renglón con **misma descripción (case-insensitive)**, **misma moneda** y **mismo total** (tolerancia 0.01). Prioridad:
1. Match exacto único → ligar a esa proforma.
2. Múltiples matches → preferir proforma con `estado_proforma='facturada'`; si hay varias facturadas, la más reciente.
3. Sin match → si el embarque tiene **una sola** proforma facturada, ligar a ésa. Si no, `proforma_id` queda `NULL`.
4. En todos los casos, `estado_facturacion` pasa a `facturado` cuando se cumple A o B.

### Consistencia
- El trigger `trg_sync_conceptos_venta_facturado` (v13.213.47) se mantiene: garantiza que embarques nuevos no repitan el problema.
- El RPC existente `backfill_conceptos_venta_facturados` (limitado a Entregado/Cerrado y sólo factura interna) queda **reemplazado** por el nuevo.

## Cambios

### 1) Migración (nueva RPC + ejecución inmediata)
- Crear `public.reconciliar_conceptos_facturados_legacy()` `SECURITY DEFINER`, misma firma de retorno `TABLE(organization_id uuid, conceptos_actualizados bigint, embarques_afectados bigint, conceptos_ligados_a_proforma bigint)`.
- Setear `app.auditoria_backfill_legacy = 'on'` al inicio y `'off'` al final (mismo patrón que la RPC actual, evita side-effects en auditoría).
- El cuerpo hace en un solo `WITH … UPDATE`:
  1. `candidatos`: conceptos pendientes de embarques en estados operativos con evidencia A o B.
  2. `matches`: para cada candidato, buscar `proforma_id` según reglas 1–3.
  3. `UPDATE conceptos_venta SET estado_facturacion='facturado', proforma_id = COALESCE(matches.proforma_id, cv.proforma_id) …`.
- Al final del script (después de `CREATE OR REPLACE FUNCTION`), llamar `SELECT * FROM public.reconciliar_conceptos_facturados_legacy();` para ejecutar la conciliación una vez.
- **No** se toca la RPC vieja `backfill_conceptos_venta_facturados` (queda como fallback histórico; se documenta como deprecada en el header de la migración).

### 2) Versionado
- `APP_VERSION` → `13.215.0` (feature, no patch).
- Entrada `[13.215.0]` en `CHANGELOG.md` describiendo:
  - Nueva RPC `reconciliar_conceptos_facturados_legacy` con reglas ampliadas.
  - Resultado de la corrida única (número de conceptos y embarques afectados se anota tras aplicar la migración).
  - Que embarques nuevos ya no lo necesitan gracias al trigger de v13.213.47.

## Fuera de alcance
- **No** se crea UI en `/admin/auditoria` (ejecución única basta).
- **No** se emiten facturas ni se crean proformas nuevas.
- Los conceptos que no encuentren `proforma_id` (embarques como ELIMP00169 sin `proforma_conceptos_consolidados` ni proforma única) quedan `facturado` con `proforma_id NULL` — coherente con "factura fuera del sistema" y consistente con lo que ya hicimos manualmente en 149/169 (ambos casos ya no aparecerán, quedan idempotentes).

## Detalles técnicos
- El `UPDATE` respeta `WHERE cv.estado_facturacion = 'pendiente'` para ser idempotente (correrlo dos veces no altera nada).
- Se usa `LATERAL` para resolver el matching por concepto sin duplicar filas.
- La comparación de totales usa `abs(cv.total - pcc.total) < 0.01` para tolerar redondeo.
- La comparación de descripción usa `lower(trim(...))` en ambos lados.
- Ninguna migración destructiva: sólo `UPDATE` sobre `conceptos_venta`. Reversible con snapshot pre-migración (`_backup_backfill_proformas_20260706` ya existe como referencia histórica; no se crea backup nuevo porque `estado_facturacion` es reconstruible desde `proformas`).
