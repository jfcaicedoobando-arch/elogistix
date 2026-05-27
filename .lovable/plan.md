
# Bloque B — Power of 10: cerrar los 3 oversized + split del query-keys factory

Objetivo: dejar `0` archivos productivos >200 líneas (hoy hay 3) y reducir
`src/lib/query/index.ts` (256) a un barrel delgado partido por dominio.
Cero cambios de comportamiento ni de API pública — sólo movimientos
internos + tests de paridad.

## Estado actual

| Archivo | Líneas | Acción |
|---|---:|---|
| `src/services/crm/leads.ts` | 209 | Partir por sub-acción en carpeta `services/crm/leads/` |
| `src/components/crm/ImportarLeadsCsvDialog.tsx` | 201 | Extraer parser/mapper a `lib/csv/leadsCsv.ts` + hook + sub-componente preview |
| `src/components/shared/BulkImportDialog.tsx` | 200 | Mover `BulkImportBody` y `BulkImportFooter` a archivo hermano |
| `src/lib/query/index.ts` | 256 | Partir por dominio en `lib/query/keys/*` y dejar `index.ts` como barrel |

## Plan paso a paso

### B1 — Partir `services/crm/leads.ts` (209)

Nueva estructura (carpeta hermana del archivo actual):

```text
src/services/crm/leads/
  index.ts        ← barrel: re-exporta todo (API pública intacta)
  queries.ts      ← listLeads, getLead
  mutations.ts    ← createLead, updateLead, softDeleteLead
  bulk.ts         ← bulkCreateLeads, bulkUpdateLeads, bulkSoftDeleteLeads
  convertir.ts    ← resolveClienteForConversion, fetchPrimeraEtapaAbierta, convertirLead, tipos ConvertirLeadParams/ResolveClienteParams
```

- `services/crm/leads.ts` se elimina; los consumidores siguen importando
  `from "@/services/crm/leads"` y resuelven a `leads/index.ts`.
- Cada archivo nuevo ≤80 líneas.
- Mantener el suite `services/crm/leads.test.ts` existente; sólo cambia el path interno.

### B2 — Refactor `ImportarLeadsCsvDialog.tsx` (201 → ~110)

Extraer:

1. **`src/lib/csv/leadsCsv.ts`** (puro, sin React):
   - `HEADER_ALIASES`, `parseCSV`, `mapRows`, tipo `ParsedRow`.
   - Tests unitarios `src/lib/csv/__tests__/leadsCsv.test.ts` (parser RFC4180 subset, mapper con/sin headers, validación de `empresa`).
2. **`src/components/crm/ImportarLeadsCsvPreview.tsx`**:
   - Sub-componente que recibe `rows` y renderiza el `<table>` (líneas 159-188 actuales).
3. **`src/hooks/crm/useImportarLeadsCsv.ts`** (cliente-only):
   - Encapsula `rows`, `fileName`, `handleFile`, `reset`, `handleImport`, `validRows`, `errorCount`.

El dialog queda como shell (~100 líneas) que orquesta hook + preview.

### B3 — Refactor `BulkImportDialog.tsx` (200 → ~120)

- Mover `BulkImportBody` y `BulkImportFooter` a
  `src/components/shared/BulkImportDialogParts.tsx` (~80 líneas).
- Mover `downloadCsvTemplate` a `src/lib/csv/downloadCsvTemplate.ts` (puro,
  testeable).
- `BulkImportDialog.tsx` queda en ~90 líneas, sin lógica de presentación.

### B4 — Partir `src/lib/query/index.ts` (256) por dominio

Nueva estructura:

```text
src/lib/query/
  index.ts         ← compone `queryKeys = { ...embarques, ...crm, ... }` y re-exporta
  keys/
    embarques.ts
    proformas.ts
    cotizaciones.ts
    clientes.ts
    facturas.ts
    proveedores.ts
    catalogos.ts   ← puertos, navieras, tiposContenedor, exchangeRates, configuracion, configuracionGlobal, configuracionOrg
    dashboard.ts   ← dashboard, operaciones, operadores, reportes, sidebar
    admin.ts       ← admin, planes, usuarios, papelera, idempotenciaLog, appLogs
    crm.ts         ← todo el bloque `crm.*` (~65 líneas, el más grande)
    portal.ts
    auditoria.ts
    facturacion.ts
    misc.ts        ← trackingLinks, jsonCargo, clienteFinancials, bitacora, pdfPreviewCotizacion, trackingPublico
```

- Cada `keys/*.ts` ≤60 líneas; `index.ts` ≤30.
- Firma pública intacta: `import { queryKeys } from "@/lib/query"` sigue
  funcionando idéntico.
- Agregar `src/lib/query/__tests__/keys-shape.test.ts` que valide que
  `queryKeys` después del split tiene exactamente las mismas claves de
  primer y segundo nivel que la baseline (snapshot del shape).

### B5 — Versionado y documentación

- `src/constants/appVersion.ts` → **`11.60.0`** (minor: refactor estructural sin breaking changes).
- `CHANGELOG.md`: nueva entrada `## [11.60.0] - 2026-05-27` con bullets por B1-B4.
- `.lovable/plan.md`: marcar B5/B6/B6b/B6c como ✅ y bajar baseline de archivos >200 a **0**.
- `docs/power10-baseline.md`: actualizar conteo "3 archivos >200" → **0**.
- `docs/architecture-map.md`: nota breve del split de `lib/query/keys/*`.

## Verificación

1. `bun scripts/audit-architecture.ts` → 0 violaciones.
2. `bun scripts/audit-power10.ts` (si existe) → 0 archivos >200 productivos.
3. Vitest: que pase el suite completo + los 2 nuevos tests
   (`leadsCsv.test.ts`, `keys-shape.test.ts`).
4. Build (Vite) sin errores de imports.
5. Revisar manualmente el preview en `/crm/leads` que el dialog de importar
   sigue funcionando idéntico.

## Detalles técnicos

- **Sin cambios de API pública**: todos los imports existentes
  (`@/services/crm/leads`, `@/lib/query`, `@/components/shared/BulkImportDialog`)
  resuelven al mismo símbolo. Esto evita tocar 50+ call sites.
- **Sin cambios de tipos**: los tipos exportados (`ConvertirLeadParams`,
  `ParsedRow`, `BulkImportDialogProps`) se re-exportan desde el barrel.
- **Power of 10 enforcement**: tras este bloque, podemos sumar al
  `architecture-baseline.test.ts` una aserción `archivosProductivosOver200 === 0`
  para que CI bloquee regresiones (lo dejo opcional, marcado en `.lovable/plan.md` para Bloque D).
- **No tocamos** `components/ui/sidebar.tsx` (637, shadcn — excepción ya documentada).

## Fuera de alcance (siguientes sprints)

- Bloque C (naming + estilos inline).
- Bloque D (split de `routes.tsx`, CI report).
- Reducción de casts HIGH (37 actuales).
