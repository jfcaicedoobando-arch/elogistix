## Objetivo
Restaurar el desglose financiero del embarque **ELIMP00058** (`30848925-…`) que tiene proforma + 2 facturas con totales pero sin conceptos individuales en ninguna tabla.

## Datos fuente (desde la proforma `PRO-2026-0024`)
- USD: subtotal 585.00 · IVA 37.60 · total 622.60 (IVA al 16% aplicado al ~40%, pero respetamos lo grabado)
- MXN: subtotal 8,500.00 · IVA 1,360.00 · total 9,860.00
- Tasa IVA registrada: 0.16
- Cliente: INDIMEX TRADING · org `00000000-0000-0000-0000-000000000001`

## Cambios (solo datos — sin migración de esquema)

### 1. `conceptos_venta` (2 filas) en el embarque
Crear dos conceptos genéricos marcados como ya facturados y vinculados a la proforma, para que el tab de Costos del embarque cuadre con la factura emitida:

| descripción | moneda | precio_unitario | total | aplica_iva | tasa_iva_aplicada | estado_facturacion | proforma_id | origen |
|---|---|---|---|---|---|---|---|---|
| "Servicios logísticos facturados (USD) — restaurado desde proforma PRO-2026-0024" | USD | 585.00 | 585.00 | true | 0.16 | facturado | bdc97c51-… | backfill |
| "Servicios logísticos facturados (MXN) — restaurado desde proforma PRO-2026-0024" | MXN | 8500.00 | 8500.00 | true | 0.16 | facturado | bdc97c51-… | backfill |

> Nota: el IVA grabado en la proforma (37.60 USD sobre 585 = 6.43%) no corresponde a 16% sobre todo el subtotal. Esto sugiere que sólo parte del concepto USD tenía IVA. Para no inventar desglose, asentamos los conceptos con el subtotal y dejamos el monto de IVA tal cual está en la cabecera de la factura/proforma — no recalculamos. `aplica_iva=true` documenta que el original llevaba IVA mixto.

### 2. `proforma_conceptos_consolidados` (2 filas)
Espejo de los dos conceptos anteriores ligados a `proforma_id = bdc97c51-…` y `embarque_id` del embarque, con `iva = 37.60` (USD) y `iva = 1360.00` (MXN) para preservar los montos originales.

### 3. `conceptos_factura` (1 fila por factura, 2 totales)
- Factura USD `0d4acfb2-…` → 1 fila: "Servicios logísticos facturados — restaurado", USD, total 585.00
- Factura MXN `c1db8a0e-…` → 1 fila: "Servicios logísticos facturados — restaurado", MXN, total 8500.00

### 4. Bitácora de actividad
Registrar un evento manual en `bitacora_actividad` por cada tabla tocada (módulo `embarques`, acción `backfill_conceptos`, entidad_nombre `ELIMP00058`) con detalles del origen del backfill y los IDs creados. Esto deja rastro auditable.

## Validación post-cambio
- Re-consultar: `conceptos_venta`=2, `conceptos_factura`=2, `proforma_conceptos_consolidados`=2.
- Sumas: USD venta total = 585, MXN venta total = 8500 (cuadra con cabeceras existentes — **no se tocan** las cabeceras de proforma ni de factura).
- Abrir `/embarques/30848925-…?tab=costos` y verificar que ahora aparece el desglose.

## Lo que NO se toca
- Totales en `proformas` y `facturas` (ya están correctos, sólo faltaba el detalle).
- Estado del embarque (sigue `Cerrado`).
- Costos (`conceptos_costo` ya tiene sus 4 filas).
- Tipo de cambio, fechas, folios fiscales.

## Riesgo / reversibilidad
Las 5 filas creadas tendrán todas `origen='backfill'` (en `conceptos_venta`) y descripciones con marcador "restaurado desde proforma PRO-2026-0024". Si quieres revertir, basta con borrar por ese criterio.

## Changelog
Bump `APP_VERSION` → `13.21.9` + entrada en `CHANGELOG.md` describiendo el backfill puntual de ELIMP00058.
