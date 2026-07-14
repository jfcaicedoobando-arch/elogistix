---
name: Auditoría · regla docs_faltantes
description: Matriz canónica de documentos exigidos por modo y estado en la auditoría de embarques. Debe coincidir con `getDocsForMode` (UI).
type: feature
---

La RPC `auditoria_embarques_org` (CTE `exigidos`) delega en `_docs_requeridos_por_estado` (fuente única). `getDocsForMode` (`src/features/embarques/constants/embarqueConstants.ts`) sólo dicta qué documentos puede **adjuntar** el usuario en el wizard — la auditoría exige un subconjunto por estado.

Matriz vigente (v13.299.18):

| Modo | Confirmado | En Tránsito | En Aduana / Llegada / Arribo / En Proceso / Entregado / EIR / Cerrado |
|---|---|---|---|
| Marítimo (default / Multimodal) | — | — | Factura Comercial, Packing List, BL Master, BL House |
| Aéreo | — | — | Factura Comercial, Packing List, Air Waybill (AWB) |
| Terrestre | — | — | Factura, Lista de Empaque, Carta Porte |

**Cambio v13.299.18**: En Tránsito ya NO exige ningún documento. Durante el tránsito es normal que Factura Comercial / Packing List aún estén pendientes de recibirse del embarcador. Toda la exigencia arranca en En Aduana (que es cuando realmente se necesitan para despacho).

**Cambio v13.299.17**: En Tránsito ya no exigía BL/AWB/Carta Porte. La v13.299.18 completa la relajación quitando también Factura Comercial y Packing List del estado En Tránsito.

Severidad `docs_faltantes`: `critico` en todos los estados donde aplica (hardcoded en `auditoria_embarques_org`).

Severidad `docs_pendientes_avanzado`: `alto` (bajada desde `critico` en v13.138.4, Fase 1 modernización auditoría). El candado `validar_cierre_embarque` ya impide cerrar embarques con documentos en estado Pendiente, por lo que dejar este hallazgo como crítico duplicaba una regla que el sistema ya bloquea.

La regla `ventas_sin_facturar` excluye embarques con `etd < 2026-04-01` (fecha de inicio del nuevo modelo de facturación FacturAPI). Los embarques históricos se reconcilian con el backfill en `/admin/auditoria`.

Al agregar un nuevo modo, actualizar `_docs_requeridos_por_estado` y `getDocsForMode` en la misma PR.
