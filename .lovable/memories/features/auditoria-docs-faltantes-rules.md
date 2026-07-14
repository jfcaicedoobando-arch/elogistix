---
name: Auditoría · regla docs_faltantes
description: Matriz canónica de documentos exigidos por modo y estado en la auditoría de embarques. Debe coincidir con `getDocsForMode` (UI).
type: feature
---

La RPC `auditoria_embarques_org` (CTE `exigidos`) y `getDocsForMode` (`src/features/embarques/constants/embarqueConstants.ts`) deben mantenerse alineadas: si la UI no permite adjuntar un documento, la auditoría no debe exigirlo.

Matriz vigente (v13.299.17):

| Modo | Confirmado | En Tránsito | En Aduana / Llegada / Arribo / En Proceso / Entregado / EIR / Cerrado |
|---|---|---|---|
| Marítimo (default / Multimodal) | — | Factura Comercial, Packing List | + BL Master, BL House |
| Aéreo | — | Factura Comercial, Packing List | + Air Waybill (AWB) |
| Terrestre | — | Factura, Lista de Empaque | + Carta Porte |

**Cambio v13.299.17**: En Tránsito ya NO exige BL/AWB/Carta Porte. Las navieras/aerolíneas entregan esos documentos días después del zarpe; exigirlos generaba falsas alarmas críticas. La obligación se movió a En Aduana en adelante (que es cuando realmente se necesitan para despacho).

Severidad `docs_faltantes`: `critico` en todos los estados donde aplica (hardcoded en `auditoria_embarques_org`).

Severidad `docs_pendientes_avanzado`: `alto` (bajada desde `critico` en v13.138.4, Fase 1 modernización auditoría). El candado `validar_cierre_embarque` ya impide cerrar embarques con documentos en estado Pendiente, por lo que dejar este hallazgo como crítico duplicaba una regla que el sistema ya bloquea.

La regla `ventas_sin_facturar` excluye embarques con `etd < 2026-04-01` (fecha de inicio del nuevo modelo de facturación FacturAPI). Los embarques históricos se reconcilian con el backfill en `/admin/auditoria`.

Al agregar un nuevo modo, actualizar **ambos** lugares en la misma PR.
