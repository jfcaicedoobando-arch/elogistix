---
name: Auditoría · regla docs_faltantes
description: Matriz canónica de documentos exigidos por modo y estado en la auditoría de embarques. Debe coincidir con `getDocsForMode` (UI).
type: feature
---

La RPC `auditoria_embarques_org` (CTE `exigidos`) y `getDocsForMode` (`src/features/embarques/constants/embarqueConstants.ts`) deben mantenerse alineadas: si la UI no permite adjuntar un documento, la auditoría no debe exigirlo.

Matriz vigente (v13.24.1):

| Modo | Confirmado | En Tránsito | En Aduana / Llegada / Arribo / En Proceso / Entregado / Cerrado |
|---|---|---|---|
| Marítimo (default / Multimodal) | Factura Comercial, Packing List | + BL Master, BL House | + Certificado de Origen, Ficha Técnica |
| Aéreo | Factura Comercial, Packing List | + Air Waybill (AWB) | + Certificado de Origen, Ficha Técnica |
| Terrestre | Factura, Lista de Empaque | + Carta Porte | Carta Porte, Factura, Lista de Empaque |

Severidad: `medio` si estado = Confirmado, `alto` para el resto.

Al agregar un nuevo modo, actualizar **ambos** lugares en la misma PR.
