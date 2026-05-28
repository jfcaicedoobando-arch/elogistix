# v12.15.0 — Limpieza Power-of-10: casts HIGH + archivos >200 líneas

Dos frentes independientes. Pueden hacerse en una sola versión (12.15.0) o partir en 12.15.0 (casts) + 12.15.1 (tamaños). Recomiendo una sola versión.

---

## Parte A — Eliminar los 4 casts HIGH

Los 4 son `as unknown as X` sobre respuestas Supabase sin validar. La regla de auditoría exige **parser/type guard** o, si el cast es inevitable, marcador `// SAFE-CAST: <motivo>` que degrada HIGH→LOW.

### A.1 `src/services/cotizacion/conversiones/embarques.ts:126`
```ts
const v = raw as unknown as Record<string, unknown> | null;
```
**Fix:** sustituir por type guard.
```ts
const v: Record<string, unknown> | null =
  raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
```
El cast restante es `as Record<string, unknown>` directo (MEDIUM, aceptable).

### A.2 `src/services/proforma/crud.ts:48`
```ts
} as unknown as Parameters<typeof supabase.rpc<"crear_proforma_atomica">>[1];
```
**Fix:** este cast existe porque los tipos generados de la RPC no aceptan el payload exacto. Es legítimo y no se puede parsear (es input a Supabase). Marcar con:
```ts
// SAFE-CAST: payload validado por Zod (crearProformaPayloadSchema) antes de llamar a la RPC; los tipos generados de Supabase no expresan el shape exacto.
} as unknown as Parameters<typeof supabase.rpc<"crear_proforma_atomica">>[1];
```
Asegurar que el `parse` Zod ocurra justo antes (si no existe, añadir `crearProformaPayloadSchema.parse(payload)`).

### A.3 `src/services/proforma/crud.ts:52`
```ts
return data as unknown as ProformaRow;
```
**Fix:** añadir validación Zod del row devuelto.
```ts
return proformaRowSchema.parse(data);
```
Si `proformaRowSchema` no existe, crearlo en `src/lib/domain/proforma.ts` derivado del tipo `ProformaRow` (campos id, folio, embarque_id, estado, totales, fechas).

### A.4 `src/services/proforma/queries.ts:103`
```ts
return (data ?? []) as unknown as ConceptoVentaRow[];
```
**Fix:** array parse.
```ts
return z.array(conceptoVentaRowSchema).parse(data ?? []);
```
Crear `conceptoVentaRowSchema` en `src/lib/domain/proforma.ts` si no existe.

**Resultado esperado:** HIGH casts 4 → 0. Total casts ~753 sin cambio significativo (sólo se reclasifican).

---

## Parte B — Dividir 5 archivos >200 líneas

Regla Power-of-10: componentes/módulos ≤200 líneas. Los 5 archivos están entre 211 y 278. Se dividen por **cohesión funcional**, sin cambio de comportamiento.

### B.1 `src/pdf/theme/styles.ts` (278)
Contiene `StyleSheet.create` con bloques por sección del PDF. Dividir en:
- `src/pdf/theme/styles/layout.ts` — page, header, footer, container
- `src/pdf/theme/styles/typography.ts` — títulos, subtítulos, texto
- `src/pdf/theme/styles/tables.ts` — filas, celdas, totales
- `src/pdf/theme/styles/index.ts` — re-export y merge en un único `styles` para no romper imports.

### B.2 `src/lib/domain/embarqueWizardSchemas.ts` (227)
Conjunto de schemas Zod por paso. Dividir por paso:
- `embarqueWizardSchemas/paso1.ts` (cliente/incoterm)
- `embarqueWizardSchemas/paso2.ts` (origen/destino/fechas)
- `embarqueWizardSchemas/paso3.ts` (carga/contenedores)
- `embarqueWizardSchemas/paso4.ts` (proveedores/conceptos)
- `embarqueWizardSchemas/index.ts` — barrel + schema compuesto `embarqueWizardSchema`.

### B.3 `src/hooks/embarque/useDialogGenerarProformaController.ts` (219)
God-hook con I/O + cálculo + UI state. Extraer:
- `src/services/proforma/calcularPreview.ts` — lógica pura de cálculo de totales/IVA preview.
- `src/hooks/embarque/proformaDialog/useProformaDialogForm.ts` — RHF state.
- `useDialogGenerarProformaController.ts` queda como orquestador (<150 líneas).

### B.4 `src/components/embarque/facturacion/ResumenConceptosVenta.tsx` (211)
Extraer subcomponentes presentacionales:
- `ResumenConceptosVenta/ConceptoRow.tsx`
- `ResumenConceptosVenta/TotalesFooter.tsx`
- `ResumenConceptosVenta/index.tsx` (~120 líneas, sólo composición).

### B.5 `src/lib/domain/proforma.ts` (211)
Mezcla tipos + schemas + helpers. Dividir:
- `proforma/types.ts` — tipos TS (`ProformaRow`, `ConceptoVentaRow`, etc.)
- `proforma/schemas.ts` — schemas Zod (incluye los nuevos `proformaRowSchema`, `conceptoVentaRowSchema` de Parte A)
- `proforma/calculos.ts` — helpers de totales
- `proforma/index.ts` — barrel.

**Importante:** mantener barrels (`index.ts`) con re-exports para que los imports existentes (`from "@/lib/domain/proforma"`, etc.) no rompan.

---

## Verificación

1. `bun run audit:report` → esperado: HIGH=0, archivos >200 líneas=0.
2. Build automático del harness verde.
3. Tests existentes verdes (`useProformas`, `embarqueWizard`, `pdf` snapshots si los hay).
4. Smoke manual: abrir un embarque, generar proforma preview, exportar PDF.

## Entregables

- Parte A: edita `embarques.ts`, `crud.ts`, `queries.ts`, añade schemas Zod en `proforma/schemas.ts`.
- Parte B: 5 directorios nuevos con sub-archivos + barrels, borrado de los 5 archivos originales.
- `reports/audit-report.{md,json}` regenerados.
- `CHANGELOG.md` → entrada `[12.15.0]`.
- `APP_VERSION` → `12.15.0`.
- `mem://audit/pendings` → cerrar P3.x correspondientes a casts HIGH y archivos >200.

## Fuera de alcance

- Los 13 casts LOW y 429 MEDIUM (política los acepta).
- Migración para retirar columnas legacy de `embarques` (P3.15, separado).
