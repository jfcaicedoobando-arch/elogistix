
# Fase 2 — D16: reducir casts HIGH a 0 en código productivo

## Hallazgo clave

Auditando los **37 HIGH casts** reportados resulta:

| Origen | Cantidad | Tratamiento |
|---|---:|---|
| **Tests** (`__tests__/`, `*.test.{ts,tsx}`) | **33** | Mocking legítimo — debe degradarse a MEDIUM |
| **Productivos** | **4** | Ya tienen comentario `SAFE-CAST:` justificándolos — necesitan API segura |

Los 4 productivos son:

1. `src/components/shared/VirtualDataTable.tsx:78` — iteración dinámica por clave para filtrar `undefined`.
2. `src/hooks/facturacion/useHuecoFacturacion.ts:43` — `readonly` → `string` para el exportador CSV.
3. `src/lib/csv/leadsCsv.ts:87` — asignación dinámica por campo CSV.
4. `src/lib/queryPersistBootstrap.ts:28` — marca privada de TanStack Query persister.

Todos tienen comentario `SAFE-CAST:` explicando por qué el cast es necesario. La auditoría no los distingue de casts inseguros.

## Plan en 2 frentes

### A. Mejorar el clasificador (`scripts/lib/casts.ts`)

Añadir dos reglas en `classify()`:

1. **Archivos de test → degradar HIGH a MEDIUM.** Test files pueden usar `as unknown as X` para mockear sin penalización. Detección: ruta contiene `__tests__/` o termina en `.test.ts(x)` o `.spec.ts(x)`.

2. **Comentario `// SAFE-CAST:` en la línea anterior → degradar HIGH a LOW.** Es un opt-out documentado: el desarrollador asumió la responsabilidad por escrito. Mantenerlo como LOW (no SAFE) permite seguir auditándolos sin alarmar.

### B. Refactor de los 4 productivos para eliminar el cast

Donde sea posible, sustituir el cast por una API tipada:

1. **`VirtualDataTable.tsx`** — Crear helper `omitUndefined<T extends object>(o: T): Partial<T>` en `src/lib/utils/omitUndefined.ts` con tipos genéricos (Object.entries + reduce, sin cast). Reemplazar el bloque.

2. **`useHuecoFacturacion.ts`** — Generalizar `exportToCsv` para aceptar `readonly { key: string; label: string }[]` (cambio en la firma) en vez de mutable. Elimina el cast en TODOS los call-sites.

3. **`leadsCsv.ts`** — Cambiar `field` a `keyof ParsedLeadRow` y usar `r[field] = val` con sobrecarga indexada en `ParsedLeadRow` (`Record<string, string | undefined> & { ... }`). Elimina el cast.

4. **`queryPersistBootstrap.ts`** — Crear wrapper `tipado` en `src/lib/queryClient.ts` que ya emite el `QueryClient` con la marca compatible. Si el conflicto es por versiones distintas de `@tanstack/query-core`, alinear versiones en `package.json` y eliminar el cast.

## Tests

- Añadir `scripts/lib/__tests__/casts.test.ts` validando:
  - `as unknown as X` en `__tests__/foo.test.ts` → severidad ≤ MEDIUM.
  - `as unknown as X` precedido por `// SAFE-CAST:` → severidad ≤ LOW.
  - `as unknown as X` en `src/lib/foo.ts` sin SAFE-CAST → HIGH.
- Actualizar `src/__tests__/audit-report.test.ts`:
  - Esperar **HIGH casts en productivo = 0** tras los refactors.
  - Mantener `expect(s.bySeverity.HIGH)` con valor menor (sólo tests degradados a MEDIUM).

## Entregables

- **`scripts/lib/casts.ts`** — clasificador con las 2 reglas nuevas + comentario explicativo.
- **`scripts/lib/__tests__/casts.test.ts`** — nuevo.
- **`src/lib/utils/omitUndefined.ts`** — helper tipado.
- **Refactors**: VirtualDataTable, useHuecoFacturacion, leadsCsv, queryPersistBootstrap.
- **Cambios de firma**: `exportToCsv` acepta `readonly` headers.
- **`docs/cast-audit.md`** — regenerado.
- **`reports/audit-report.{md,json}`** — regenerado.
- **`CHANGELOG.md` + `appVersion.ts`** → `11.64.0`.
- **`.lovable/plan.md`** → D16 ✅ cerrado, Fase 3 marcada como próxima.
- **`mem://principles/safe-cast`** — nueva memoria: cuándo usar `// SAFE-CAST:` y formato esperado.

## Fuera de alcance

- Tocar los 33 casts en tests (quedan como MEDIUM tras la regla A; son mocks intencionales).
- Romper APIs públicas de servicios — los refactors son aditivos o de generalización de firma.
- D12 (split `routes.tsx`), C10 adicional, P1.5+ — son fases posteriores.

## Criterio de éxito

```
audit-report.json → casts.bySeverity.HIGH = 4   (sólo tests, todos degradables si se quiere)
                  → casts.bySeverity.CRITICAL = 0
productivo HIGH   = 0
audit-report.test pasa con baseline actualizado
```
