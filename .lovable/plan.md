## Diagnóstico ELNAC00237

**Embarque:** `ELNAC00237` — modo **Terrestre**, estado **Cerrado**, ETA 2026-06-05.

**Documentos reales del embarque** (`documentos_embarque`):
| Nombre | Estado | Archivo |
|---|---|---|
| Carta Porte | Recibido | ✅ |
| Factura | No aplica | — |
| Lista de Empaque | No aplica | — |

Según la UI (`getDocsForMode` en `embarqueConstants.ts`), el catálogo Terrestre es exactamente: **Carta Porte, Factura, Lista de Empaque**. Por eso al entrar al embarque no aparecen otras opciones — el embarque ya tiene sus 3 documentos requeridos cubiertos (uno recibido + dos marcados "No aplica").

**De dónde viene el hallazgo falso (severidad alto):**
La RPC `compute_auditoria_v1` (migración `20260615221107…`) tiene una matriz `VALUES` que define documentos exigidos por estado, pero sólo distingue dos casos:

```sql
CASE WHEN e.modo::text = 'Aéreo'
  THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)', …]
  ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)', …]
END
```

El `ELSE` cae para **Terrestre y Multimodal**, así que la auditoría les exige BL Master, BL House, Certificado de Origen y Ficha Técnica — documentos que el catálogo de UI nunca expone para Terrestre, por lo que el usuario no puede "arreglar" el hallazgo. Resultado: el embarque queda marcado en alto de forma permanente y contradictoria con la UI.

## Solución propuesta

Una sola migración que reescribe el CTE `exigidos` de `compute_auditoria_v1` para alinear el set exigido con `getDocsForMode`:

| Modo | Confirmado | En Tránsito | En Aduana / Llegada / Arribo / En Proceso / Entregado / Cerrado |
|---|---|---|---|
| Marítimo (y default) | Factura Comercial, Packing List | + BL Master, BL House | + Certificado de Origen, Ficha Técnica |
| Aéreo | Factura Comercial, Packing List | + Air Waybill (AWB) | + Certificado de Origen, Ficha Técnica |
| **Terrestre** | Factura, Lista de Empaque | + Carta Porte | (mismos: Carta Porte, Factura, Lista de Empaque) |
| **Multimodal** | Factura Comercial, Packing List | + BL Master, BL House (igual a Marítimo) | + Certificado de Origen, Ficha Técnica |

Nota: para Terrestre el set es chico y estable; no se exigen documentos que el wizard nunca crea.

## Cambios técnicos

1. **Migración SQL nueva** que ejecuta `CREATE OR REPLACE FUNCTION public.compute_auditoria_v1(...)` reescribiendo el CTE `exigidos` con un `CASE` de tres ramas (`Aéreo`, `Terrestre`, ELSE = Marítimo/Multimodal). El resto del cuerpo (faltantes, hall_*, jsonb_build_object) queda intacto.
2. **`CHANGELOG.md`** + bump `APP_VERSION` siguiendo el contrato del proyecto.
3. **Memoria** `mem://features/auditoria-docs-faltantes-rules` con la matriz canónica para futuras referencias.

## Verificación post-deploy

- Re-correr `compute_auditoria_v1` para la organización del embarque y confirmar que ELNAC00237 ya no aparece bajo `docs_faltantes`.
- Spot-check de un embarque Aéreo y uno Marítimo para asegurar que su severidad no cambió.

## Fuera de alcance

- No se toca la UI de `TabDocumentos` ni `getDocsForMode` — ya están correctas.
- No se modifican otras reglas (`docs_pendientes_avanzado`, `proforma_vencida`, etc.).
