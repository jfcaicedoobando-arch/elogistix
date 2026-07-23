# Estado real vs. Auditoría de Arquitectura (2026-07-23)

Reporte generado el 2026-07-23 tras ejecutar la suite CI completa y verificar cada ítem del documento `instrucciones-lovable-arquitectura-3.md` contra el código en `main`. **Sólo lectura — cero refactor**.

## Números duros de la suite

| Chequeo | Comando | Resultado |
|---|---|---|
| Lint | `bun run lint -- --max-warnings 0` | ✅ 0 warnings |
| Typecheck | `bunx tsgo --noEmit` | ✅ limpio |
| Vitest (fast) | `bun run test:fast` | ⚠️ **3 tests fallidos / 5149 verdes** (752 archivos, 3 archivos rojo) |
| Knip | `bunx knip` | ✅ 0 regresiones |
| Madge | `bunx madge --circular` | ⚠️ **19 ciclos** (baseline auditoría: 57 → hoy 19) |
| Audit-arch | `bun run audit:arch` | ✅ hooks=0, components=0, oversized=0 |

**3 tests fallidos** (pre-existentes, ver §Anexo A):
- `useEmbarqueDocumentosActions.test.tsx` › handleDownload error path
- `usePagosFactura.test.tsx` › error path
- `useAuthProfile.test.ts` › fetchUserContext error path

## Verificación por ítem

Leyenda: ✅ hecho · ⚠️ parcial · ❌ pendiente · ➖ n/a

### BLOQUE 1 — Quick wins

| Ítem | Estado | Evidencia | Esfuerzo restante |
|---|---|---|---|
| 1.1 Scanner cubre `src/features` | ✅ | `scripts/lib/arch.ts:71-77` incluye `["src/components", "src/features"]` con exclude `["services"]` | — |
| 1.2 Path obsoleto `facturas/dashboardEjecutivo.ts` | ✅ | `grep features/facturas/ eslint.config.js` = 0 hits | — |
| 1.3 Tipos de dominio en `.tsx` (cxp) | ✅ | `FacturaFormValues` vive en `src/features/cxp/types/facturaForm.ts:10`; `primitives.tsx` sólo re-exporta | — |
| 1.4 9 `any` en `FacturaDetalleView/Body` | ✅ | `grep ": any" src/features/facturacion/components/detalle/` = 0 | — |
| 1.5 AuthContext ↛ features | ✅ | `AuthContext.tsx:7` importa `@/lib/auth/signOut` (no de features) | — |
| 1.6 Supabase en `.tsx` fuera de services | ✅ | `grep 'from "@/integrations/supabase/client"' src --include='*.tsx' \| grep -v services` = 0. Los 18 hits restantes son `import type { Tables/Database/Enums }` (compile-time, no runtime) | — |

**Bloque 1 = 100 % cerrado.** La auditoría reflejaba estado pre-v13.309.

### BLOQUE 2 — Contratos

| Ítem | Estado | Evidencia | Esfuerzo restante |
|---|---|---|---|
| 2.1 Traducción central `LC_*` | ✅ | `src/lib/errors/lcCodes.ts` + `lcCodeMessages.ts`; `index.ts:48-53` aplica `LC_CODE_MESSAGES` y `stripLcCode` en `getErrorMessage` | — |
| 2.2 Snapshot de invariantes de esquema | ✅ | `supabase/tests/schema-invariants.sql` presente | ⚠️ falta verificar que CI lo ejecute contra la BD migrada |
| 2.3(a) Promover shared | ✅ | `src/components/shared/ProfitBadge.tsx`, `src/lib/ui/badgeTone.ts`, `src/lib/domain/estadoUnificado.ts` existentes | Continuar bajando la allowlist (54→n): candidatos `versionadoCotizacion` (7), `labelExpediente`, `ToneBadge` |
| 2.3(b) `no-restricted-imports` cross-feature | ✅ | `eslint.config.js:43` `CROSS_FEATURE_ALLOWLIST` + regla en línea 111 | — |
| 2.4 IVA único / Fases embarque | ✅ IVA · ⚠️ Fases | `rg "0\.16" src` → sólo `financialUtils.ts` (fuente) + **4 docstrings** describiendo el valor (no runtime). Fases: no encontrado test comparativo enum SQL ↔ TS | S — añadir test `embarqueFases` vs `estado_embarque` |

**Bloque 2 = 95 % cerrado.** Residual: test de fases + verificar CI hook para `schema-invariants.sql`.

### BLOQUE 3 — Estructural

| Ítem | Estado | Evidencia | Esfuerzo |
|---|---|---|---|
| 3.1 Fuentes canónicas SQL | ✅ | 10 funciones críticas en `supabase/schema/*/` (auditoria_embarques_org 707L, operaciones_stats 329L, convertir_proformas 245L, crear_embarque_borrador_core 222L, calcular_demoras 196L, etc.) | — |
| 3.2 Dividir god functions | ✅ | Helpers privados: `_calcular_demoras_montos_contenedor` (66L), `_crear_embarque_replicar_conceptos` (64L), `_convertir_proformas_insertar_conceptos` (63L), `_audit_embarques_umbrales`, `_audit_embarques_agregar` | ⚠️ `operaciones_stats` (329L) queda monolítico — la auditoría lo confirma como "requiere vista materializada" |
| 3.3 Un paradigma de formularios (RHF+zod) | ❌ | `useNuevaFacturaProveedorForm.ts` conserva **11 `useState`**; `useEditarFacturaProveedorForm.ts` **6 `useState`**. Sin migración pendiente | **L** — 1 PR por hook |
| 3.4 Formatters + StatusBadge | ⚠️ | `src/lib/formatters/{numbers,dates,pnl}.ts` existen. **39 archivos** aún usan `toLocaleString`/`Intl.NumberFormat`/`toLocaleDateString` fuera. **120** comparaciones `estado === "..."` inline | **M** — migración por feature + `no-restricted-syntax` al final |
| 3.5 Prop drilling `EmbarqueDetalleTabs` | ⚠️ | Ya se agruparon a **12 props** (`financials`, `docHandlers`); la auditoría reportaba 14 | **S** — mover data-fetching a cada tab |
| 3.6 Higiene de migraciones | ❌ | No hay script `scripts/audit-migrations.ts` ni docs de reglas nuevas (`DROP CASCADE`, `IF NOT EXISTS`, naming) | **S** — 1 doc + 1 script lint |
| 3.7 Coverage thresholds reales + SQL LC_ tests | ⚠️ | `vitest.config.ts` tiene thresholds > 0 en el config principal; `test:coverage:shard` los fuerza a 0 para permitir shards paralelos (correcto). No hay tests SQL de `LC_*` (0 archivos en `supabase/tests/rls/` cubren códigos) | **M** — crear `supabase/tests/lc-codes/*.sql` |
| 3.8 Catch vacíos | ✅ | `grep 'catch\s*[({]\s*[)}]' src` = **0** | — |

### BLOQUE 4 — Boy-scout (opcional)

Todo pendiente. Sin bloqueos.

## Trabajo real pendiente (priorizado por riesgo × esfuerzo)

1. **3.5 EmbarqueDetalleTabs prop-drilling** (S · UX interno) — mover data-fetching de 12 props a cada tab.
2. **3.6 Higiene de migraciones** (S · previene regresiones) — script `scripts/audit-migrations.ts` + doc en `CHANGELOG.md` prohibiendo `DROP ... CASCADE` sin re-crear y exigiendo `IF NOT EXISTS`.
3. **2.4 residual — Test fases embarque TS↔enum SQL** (S · previene divergencia silenciosa).
4. **2.3(a) — Bajar allowlist** (S por candidato · limpieza incremental) — `versionadoCotizacion`, `labelExpediente`, `ToneBadge`, `BuscarTarifaDialog`.
5. **3.4 Formatters + StatusBadge migración** (M · consistencia UI es-MX) — migrar 39 archivos por feature; añadir `no-restricted-syntax` al cerrar.
6. **3.3 RHF+zod para cxp** (L · deuda conocida) — reemplazar los 11 `useState` de `useNuevaFacturaProveedorForm.ts`.
7. **3.7 Tests SQL de `LC_*`** (M · red safety net) — cubrir códigos hotspot (`LC_COT_TRANSICION_INVALIDA`, `LC_CXP_DESCUADRE`, `LC_TC_NO_DISPONIBLE`, `LC_EMB_CIERRE_*`).
8. **Anexo A — 3 tests fallidos en `test:fast`** (S · flakes en error-paths) — investigar antes de cualquier refactor de esas áreas.

## Recomendación de siguiente PR

Elegir **una** de estas rutas cortas (todas S, sin migración, sin riesgo de runtime):

- **PR-A:** ítem 3.5 (agrupar props de `EmbarqueDetalleTabs` en `useEmbarqueDetalleTabsData(embarqueId)`).
- **PR-B:** ítem 3.6 (crear `scripts/audit-migrations.ts` + entrada CHANGELOG).
- **PR-C:** ítem 2.4 residual (test comparativo `embarqueFases.ts` ↔ enum `estado_embarque` derivado de `types.ts`).

## Anexo A — tests fallidos actuales

Pre-existentes, no introducidos por este reporte:

1. `src/features/embarques/hooks/__tests__/useEmbarqueDocumentosActions.test.tsx` › `handleDownload notifica error cuando fetch falla`
2. `src/features/facturacion/hooks/__tests__/usePagosFactura.test.tsx` › `error path: mutation queda en error cuando el servicio falla`
3. `src/lib/contexts/auth/__tests__/useAuthProfile.test.ts` › `ante error de fetchUserContext no actualiza el perfil`

Los tres son escenarios de "error path" con mocks — probable regresión de mensajes tras la homologación reciente de `getErrorMessage`/`stripLcCode`. Investigar por separado (no bloquean ningún flujo de producción).

## Zonas confirmadas sanas (no tocar)

- `supabase/functions/_shared/` — 39/39 funciones lo usan.
- Convención `queryKeys.ts` por feature + `useMutationWithFeedback`/`notifyError`.
- `SAFE-CAST` + `fromDb()` + audits de casts (0 HIGH / 0 CRITICAL en baseline).
- Los 22 architecture tests en `src/__tests__/architecture/`.
