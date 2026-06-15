---
name: Auditoría reglas proformas
description: Reglas de auditoría sobre proformas — endurecimiento de proforma_vencida y nuevos hallazgos de borrador
type: feature
---
Reglas de auditoría sobre proformas (v13.24.0+):

- **`proforma_vencida`**: aplica SOLO a proformas reales (estado_aprobacion <> 'borrador', total_mxn > 0, con conceptos_venta vinculados, estado_proforma='pendiente' y más de `dias_proforma_vencida` días). Severidad alto.
- **`proforma_borrador_abandonada`**: borrador (estado_aprobacion='borrador') con total cero o sin conceptos, más de `dias_borrador_abandonado` días (default 15, configurable en `configuracion` categoria='auditoria'). Severidad medio.
- **`proforma_inconsistente`**: borrador vacío vinculado al mismo embarque donde hay conceptos_venta pendientes (estado_facturacion='pendiente' AND proforma_id IS NULL). Severidad alto.

UI:
- `HistorialProformas.tsx` muestra badge "Borrador vacío" (helper exportado `esBorradorVacio`).
- `ProformaInconsistenteAlert` en `TabFacturacion` ofrece dos acciones: asignar todos los conceptos huérfanos al borrador (RPC `asignar_conceptos_a_proforma`) o eliminar el borrador (flujo `useEliminarProforma` existente).

RPC `asignar_conceptos_a_proforma(p_proforma_id uuid, p_concepto_ids uuid[])`:
- SECURITY DEFINER, `_assert_writer` valida tenancy.
- Solo asigna conceptos del mismo embarque, misma organización, estado_facturacion='pendiente', proforma_id IS NULL.
- Recalcula subtotal_usd/iva_usd/total_usd y subtotal_mxn/iva_mxn/total_mxn de la proforma.
- Lanza excepción si la proforma está facturada o si ningún concepto califica.
