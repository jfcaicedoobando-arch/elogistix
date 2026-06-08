## Objetivo

Cada fila de concepto (venta y costo) lleva su propia **tasa de IVA** (`0`, `0.08`, `0.16`, o cualquier numérico ≥0). Toda la suite financiera respeta esa tasa al construir payloads, totales y PDFs. El fallback `0.16` deja de aplicarse automáticamente al sumar; sólo se usa como **default de UI** al crear una fila nueva (tomado de `useTasaIVA`).

## 1. Migración de BD

Agregar columna `tasa_iva_aplicada NUMERIC(5,4) NOT NULL DEFAULT 0.16` a:

- `public.conceptos_venta`
- `public.conceptos_costo`

Backfill: `UPDATE … SET tasa_iva_aplicada = CASE WHEN aplica_iva THEN 0.16 ELSE 0 END`.

Constraint: `CHECK (tasa_iva_aplicada >= 0 AND tasa_iva_aplicada <= 1)`.

> El JSON `cotizaciones.conceptos_venta` no requiere migración de schema (es jsonb) — los nuevos registros incluirán `tasa_iva_aplicada`; los viejos se leen con fallback derivado de `aplica_iva`.

## 2. Refactor de `src/lib/financial/financialUtils.ts`

- Eliminar el default `= TASA_IVA` en `calcularIVA` y `calcularTotalConIVA`. La tasa pasa a ser **obligatoria**.
- Conservar `TASA_IVA = 0.16` sólo como **semilla** para defaults de UI, marcado `@deprecated for math`.
- Añadir helper puro `resolverTasaConcepto(concepto, fallback)` que devuelve:
  1. `concepto.tasa_iva_aplicada` si está definida (incluye 0).
  2. `fallback * Number(concepto.aplica_iva)` si no.

## 3. Tipos

- `ConceptoVentaCotizacion` (`src/types/cotizacion.ts`): agregar `tasa_iva_aplicada: number`.
- `ConceptoVentaLocal` / `ConceptoCostoLocal` (`src/types/concepto.ts`): agregar `tasaIvaAplicada: number`.
- Regenerar tipos Supabase (automático tras migración).

## 4. UI — selector de tasa por fila

Reemplazar el checkbox `aplica_iva` por un `<Select>` con opciones:

```text
0%    — Exento (flete marítimo internacional)
8%    — Frontera
16%   — General
```

Archivos afectados:

- `src/components/cotizacion/conceptos/ConceptoRows.tsx` (USD y MXN)
- `src/features/embarques/components/facturacion/GrupoConceptosContenedor.tsx`
- `src/features/embarques/components/facturacion/ResumenConceptosVenta.tsx`
- Wizards de embarque/cotización donde se editan conceptos.

`aplica_iva` se deriva como `tasa_iva_aplicada > 0` (mantener columna en BD para compatibilidad con RPCs existentes, pero ya no se edita directamente).

## 5. Cálculos: usar tasa por fila

Reemplazar `calcularIVA(sub, tasaIva)` por `calcularIVA(sub, resolverTasaConcepto(c, tasaIvaGlobal))` en:

- `src/generators/cotizacion/conceptosTables.ts`
- `src/lib/parsers/cotizacionDetalle.ts`
- `src/lib/domain/proforma.ts`
- `src/lib/domain/cotizacion.ts`
- `src/features/embarques/hooks/useDialogGenerarProformaController.ts`
- `src/features/embarques/components/facturacion/ResumenConceptosVenta.tsx`
- `src/hooks/cotizacion/usePortalCotizacionDetalle.ts`
- `src/pdf/documents/CotizacionDocument.tsx`
- `src/pdf/documents/ProformaDocument.tsx` y `ProformaConsolidadaDocument.tsx`

Para MXN: el subtotal ya no aplica `tasaIvaGlobal` ciegamente; cada concepto MXN puede ahora tener su propia tasa (default 16%).

## 6. Payloads de inserción

- `src/services/cotizacion/conversiones/embarquesHelpers.ts` → propagar `tasa_iva_aplicada` al insertar `conceptos_venta`.
- `src/features/embarques/hooks/submitProformaDialog.ts` → enviar tasa por fila a la RPC; ajustar `p_tasa_iva` (proforma) para que sea el **promedio ponderado** o se elimine en favor de la columna por concepto (verificar RPC `crear_proforma_atomica`).
- `src/services/cotizacion/mutations/{crear,update}.ts` → incluir `tasa_iva_aplicada` en cada concepto del JSON.

## 7. RPC / Edge functions

Auditar funciones SQL que reciben `p_tasa_iva` y aplican una sola tasa al total: cambiar a `SUM(subtotal * tasa_iva_aplicada)` por fila. Lista probable: `crear_proforma_atomica`, `consolidar_proformas`. Plan: migración adicional que ajuste la lógica.

## 8. Tests

Actualizar y agregar casos:

- `src/lib/financial/__tests__/financialUtils.test.ts` — quitar pruebas que asumen default 0.16; agregar `resolverTasaConcepto`.
- `src/generators/cotizacion/__tests__/conceptosTables.test.ts` — concepto con `tasa_iva_aplicada=0.08` produce IVA correcto; concepto exento (0) produce 0.
- `src/lib/parsers/__tests__/cotizacionDetalle.test.ts` — mezcla de tasas.
- `src/lib/domain/__tests__/proforma.test.ts` — fila exenta no suma IVA aunque global=0.16.
- `src/features/embarques/hooks/__tests__/submitProformaDialog.test.ts` — payload incluye `tasa_iva_aplicada` por fila.
- `src/pdf/documents/__tests__/CotizacionDocument.test.tsx` — render etiqueta `+IVA 8%` cuando aplica.

## 9. Memoria y changelog

- Actualizar `mem://technical/financial-calculations-standards`: la tasa global ya **no se aplica ciegamente**; siempre se prefiere `concepto.tasa_iva_aplicada`.
- Bump `APP_VERSION` y entrada nueva en `CHANGELOG.md` (root).

## 10. Orden de ejecución

1. Migración SQL (paso 1) → esperar aprobación.
2. Refactor `financialUtils` + tipos.
3. UI selector + propagación en wizards.
4. Cálculos en hooks/domain/PDFs.
5. Payloads e inserción.
6. RPCs (segunda migración si requiere SQL).
7. Tests.
8. Memoria + changelog + bump versión.

## Riesgos

- Cotizaciones antiguas en jsonb sin `tasa_iva_aplicada`: el parser hace fallback a `aplica_iva ? 0.16 : 0`, así que el cálculo no cambia para datos existentes.
- RPCs `p_tasa_iva` pueden requerir versión transicional que acepte ambos modelos.
