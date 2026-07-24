# Estado real vs. Auditoría de Arquitectura (2026-07-23)

Reporte actualizado el 2026-07-23 tras ejecutar los PRs de cierre del plan de ejecución. **Actualización v13.309.24**: cerrados PR-1 (Ítem 3.5), PR-2 (Anexo A), PR-3 (allowlist ToneBadge) y 2.4 doc.

## Números duros de la suite

| Chequeo | Comando | Resultado |
|---|---|---|
| Lint | `bun run lint -- --max-warnings 0` | ✅ 0 warnings |
| Typecheck | `bunx tsgo --noEmit` | ✅ limpio |
| Vitest arquitectura | `bunx vitest run src/__tests__/architecture` | ✅ 158/158 |
| Audit-arch | `bun run audit:arch` | ✅ hooks=0, components=0, oversized=0 |
| Audit-migrations | `bun run audit:migrations` | ✅ post-baseline limpio (reglas H1-H6) |

## Verificación por ítem

Leyenda: ✅ hecho · ⚠️ parcial · ❌ pendiente · ➖ n/a

### BLOQUE 1 — Quick wins

**100% cerrado** — sin cambios respecto al reporte anterior.

### BLOQUE 2 — Contratos

| Ítem | Estado | Evidencia |
|---|---|---|
| 2.1 Traducción central `LC_*` | ✅ | `src/lib/errors/lcCodes.ts` + `lcCodeMessages.ts` |
| 2.2 Snapshot de invariantes de esquema | ✅ | `supabase/tests/schema-invariants.sql` presente |
| 2.3(a) Promover shared | ⚠️ | Promovido `ToneBadge` a `components/shared/` (v13.309.23). Allowlist: 54 → **51 entradas**. Pendiente: `versionadoCotizacion` (7 consumidores) y `labelExpediente` (3 consumidores). |
| 2.3(b) `no-restricted-imports` cross-feature | ✅ | `eslint.config.js:43` |
| 2.4 IVA único / Fases embarque | ✅ | IVA en `financialUtils.ts`. Fases: `embarqueFases.invariant.test.ts` cubre TS ↔ enum SQL. |

**Bloque 2 = 100 % cerrado.** v13.309.27 (PR-3b) promovió `versionadoCotizacion` y `labelExpediente` a `src/lib/domain/`; allowlist cross-feature en **44** entradas (ARCH-DEBT, en burn-down).

### BLOQUE 3 — Estructural

| Ítem | Estado | Evidencia |
|---|---|---|
| 3.1 Fuentes canónicas SQL | ✅ | 10 funciones críticas en `supabase/schema/*/` |
| 3.2 Dividir god functions | ✅ | Helpers privados extraídos; `operaciones_stats` (329L) queda monolítico por diseño |
| 3.3 Un paradigma de formularios (RHF+zod) | 🟡 | **Paso 1 hecho** (v13.309.28): schema zod `buildFacturaFormSchema` + `validateFactura` en `useNuevaFacturaProveedorForm.schema.ts` valida ambos hooks de CxP. **Paso 2 pendiente**: migrar `useNuevaFacturaProveedorForm.ts` (10 `useState`) y `useEditarFacturaProveedorForm.ts` (5 `useState`) a `useForm`. |
| 3.4 Formatters + StatusBadge | 🟡 | v13.309.26 (PR-5): migrados 12 hotspots a `@/lib/formatters` (`formatFechaEs`, `formatFechaHora`, `formatFechaLarga`, `formatCurrency`, `formatNumber`). ESLint `no-restricted-syntax` bloquea `toLocaleString`/`toLocaleDateString`/`new Intl.NumberFormat`. **Allowlist `locale-format-legacy` AGOTADA** para hotspots productivos: solo restan `lib/formatters/**` y `lib/date/mx.ts` (implementación de referencia). Falta consolidación `<StatusBadge>` (68 sitios `estado === "..."`). |
| 3.5 Prop drilling `EmbarqueDetalleTabs` | ✅ | `useEmbarqueDetalleTabsData(embarqueId, embarque)` — Tabs pasa de 12 → 6 props; data-fetching + `docHandlers` + `financials` dentro del hijo. Ruta usa `useEmbarqueEstadoActions` directo. |
| 3.6 Higiene de migraciones | ✅ | `scripts/audit-migrations.ts` con reglas H1-H6 (baseline `20260723180000`) + `docs/migrations-hygiene.md` |
| 3.7 Coverage thresholds + SQL LC_ tests | ✅ | Thresholds correctos. `lc-codes-sql-wiring.test.ts` valida `LC_CXP_DESCUADRE`, `LC_CIERRE_SOLO_RPC`, `LC_EMBARQUE_BLOQUEADO` (RAISE en migraciones) + `LC_TC_NO_DISPONIBLE` (throw en frontend), y contrato `translateLcCode()` en 3 capas. |
| 3.8 Catch vacíos | ✅ | 0 en `src` |

### BLOQUE 4 — Boy-scout (opcional)

Sin bloqueos.

## Trabajo pendiente

Ordenado por riesgo × esfuerzo (post-v13.309.23):

1. **PR-1 · Ítem 3.5** — `useEmbarqueDetalleTabsData(embarqueId)` para mover data-fetching a los tabs. **S**.
2. **PR-4 · Ítem 3.7** — Tests SQL de `LC_CXP_DESCUADRE`, `LC_TC_NO_DISPONIBLE`, `LC_EMB_CIERRE_*`. **M**.
3. **PR-5 · Ítem 3.4** — Migración parcial (3 features) a `formatMxn`/`formatUsd`/`formatDate` + `<StatusBadge>`. **M**.
4. **PR-6 · Ítem 3.3** — RHF+zod para `useNuevaFacturaProveedorForm` (11 `useState` → 1 `useForm`). **L**.
5. **PR-3b · Ítem 2.3(a)** — Promover `versionadoCotizacion` y `labelExpediente` a `lib/domain/`. **S**.

## Anexo A — tests fallidos: cerrado ✅

Los 3 tests documentados como flaky en el reporte previo están hoy hardened (v13.309.22 + v13.309.23):

- `useEmbarqueDocumentosActions.test.tsx`: `beforeEach { clearAllMocks + re-fijar defaults }`.
- `usePagosFactura.test.tsx`: `mockReset()` explícito por mock + `waitFor` con timeout 3000 ms en error path.
- `useAuthProfile.test.ts`: `waitFor` con timeout 3000 ms en error path.

Verificados 3 corridas seguidas: 14/14 tests verdes.

## Zonas confirmadas sanas (no tocar)

- `supabase/functions/_shared/` — 39/39 funciones lo usan.
- Convención `queryKeys.ts` por feature + `useMutationWithFeedback`/`notifyError`.
- `SAFE-CAST` + `fromDb()` + audits de casts (0 HIGH / 0 CRITICAL en baseline).
- Los 22 architecture tests en `src/__tests__/architecture/` (158/158 verdes).
- Regla H6 del auditor de migraciones (v13.309.22): `SECURITY DEFINER` con REVOKE + GRANT EXECUTE explícitos, `TO PUBLIC` prohibido.
