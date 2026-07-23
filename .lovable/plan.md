# Cierre de Bloque 3 — Arquitectura Auditoría 3

Objetivo: dejar los 5 ítems pendientes en ✅ y el pipeline (`lint`, `tsgo`, `test:fast`, `knip`, `madge`, `audit:arch`) en verde. Se ejecuta como **5 PRs incrementales** para mantener cada cambio revisable y evitar regresiones.

---

## PR-1 · 3.5 EmbarqueDetalleTabs sin prop-drilling (S)

- Crear hook `useEmbarqueDetalleTabsData(embarqueId)` en `src/features/embarques/hooks/` que agrupe fetch de `financials` + `docHandlers` + tracking.
- Refactor `EmbarqueDetalleTabs.tsx`: pasa de 12 props a 2 (`embarqueId`, `tab`). Cada `<TabX>` consume el hook o su propio slice.
- Mover data-fetching que hoy vive en el padre a cada tab (`TabTracking`, `TabFinancieros`, `TabDocumentos`, `TabDemoras`).
- **Entrega**: tabs autocontenidas + tests de integración que cubran render de cada tab.

## PR-2 · 3.6 Higiene de migraciones (S)

- Crear `scripts/audit-migrations.ts` que recorre `supabase/migrations/*.sql` y falla si detecta:
  - `DROP ... CASCADE` sin `CREATE OR REPLACE` posterior en el mismo archivo.
  - `CREATE TABLE` en `public.*` sin `GRANT` en la misma migración.
  - `CREATE INDEX`/`CREATE POLICY` sin `IF NOT EXISTS` cuando es idempotente.
  - Naming fuera de `YYYYMMDDHHMMSS_snake_case.sql`.
- Añadir `bun run audit:migrations` a `package.json` y a `scripts/ci-fast.sh`.
- Documentar reglas en `docs/migrations-hygiene.md` + entrada en `CHANGELOG.md`.

## PR-3 · 2.4 residual + 3.7 SQL LC_* tests (S+M)

- **Test fases**: `src/lib/__tests__/embarque-fases-vs-enum.test.ts` compara `embarqueFases.ts` con `Database['public']['Enums']['estado_embarque']` derivado de `types.ts`.
- **Tests SQL LC_***: crear guardrails estilo `demoras-recalculo-seguro-fase-h.test.ts` (lee migraciones + regex) para los códigos hotspot que aún no tienen test:
  - `LC_COT_TRANSICION_INVALIDA`
  - `LC_CXP_DESCUADRE` (ya existe → extender a variantes)
  - `LC_TC_NO_DISPONIBLE`
  - `LC_EMB_CIERRE_*`
- Coverage: mantener `vitest.config.ts` con thresholds ≥ 0.5 en el config principal, `test:coverage:shard` conserva 0 (documentado en el archivo).

## PR-4 · 3.4 Formatters + StatusBadge (M)

Migración por feature (una feature por commit dentro del PR):

1. `features/facturacion` → `formatters/{numbers,dates,pnl}` + `StatusBadge` (reemplaza los ~120 `estado === "..."` inline por `statusVariant()`).
2. `features/cxp`.
3. `features/embarques`.
4. `features/cotizacion` + `features/profit`.
5. Al cerrar: añadir regla `no-restricted-syntax` que prohíba `toLocaleString`/`toLocaleDateString`/`new Intl.NumberFormat` fuera de `src/lib/formatters/`.

**Meta**: 39 archivos → 0, allowlist vacío para formatters.

## PR-5 · 3.3 RHF+zod en CxP (L)

- Reemplazar los `useState` sueltos en:
  - `useNuevaFacturaProveedorForm.ts` (11 useState → un solo `useForm<FacturaProveedorFormValues>` con schema zod).
  - `useEditarFacturaProveedorForm.ts` (6 useState → mismo patrón, `defaultValues` desde row).
- Reutilizar `FacturaFormValues` de `src/features/cxp/types/facturaForm.ts`.
- Adaptar `NuevaFacturaProveedorDialog` / `EditarFacturaProveedorDialog` a `FormProvider` + `Controller`.
- Tests: usar `assertMutation` + `withFrozenClock` existentes; verificar validación de cuadre (`CuadreConceptosBar` sigue funcionando).

---

## Anexo · Reparar 3 error-path tests preexistentes

Antes de PR-1, en un commit corto:

1. `useEmbarqueDocumentosActions.test.tsx` — ajustar aserción al mensaje humano nuevo emitido por `stripLcCode`.
2. `usePagosFactura.test.tsx` — idem.
3. `useAuthProfile.test.ts` — idem (comparar contra `getErrorMessage(err)` en lugar de string literal).

Sin cambiar producción; sólo actualizar expectativas del test al contrato actual de mensajes.

---

## Detalles técnicos

- **Cada PR** cierra con: `bun run lint -- --max-warnings 0`, `bunx tsgo --noEmit`, `bun run test:fast`, `bunx knip`, `bunx madge --circular` (no debe subir de 19), `bun run audit:arch`.
- **CHANGELOG.md** entrada por PR + bump `APP_VERSION` (`13.309.21` → `13.309.25`).
- **No se toca `src/integrations/supabase/*`** (auto-gen).
- **Zonas confirmadas sanas** del reporte se dejan intactas.

## Riesgos y mitigación

- PR-4 (formatters) es el más invasivo visualmente → snapshot review por feature antes del merge.
- PR-5 (RHF) puede romper flujos de captura CxP → E2E `03-factura.spec.ts` + `08-flujo-fiscal.spec.ts` se corren en cada commit.
- PR-1 mueve fetch a tabs → verificar que no dispare N+1 requests con React Query cache (misma `queryKey`).

## Orden de ejecución sugerido

```text
Anexo tests → PR-1 → PR-2 → PR-3 → PR-4 → PR-5
   (S)        (S)     (S)    (S+M)  (M)    (L)
```

Total estimado: 5 PRs, ~1 sesión larga cada uno. Si preferís, puedo arrancar sólo por el Anexo + PR-1 y pausar para tu revisión antes de continuar.
