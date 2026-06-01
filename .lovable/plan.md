# Plan de cobertura de tests — v12.37.0+

Inventario completo basado en auditoría cross-reference `src/` ↔ `__tests__/` y revisión de `e2e/specs/`. **Estado actual**: 786 tests / 118 archivos en verde.

---

## Resumen ejecutivo


| Categoría                      | Archivos faltantes | LOC estimados  |
| ------------------------------ | ------------------ | -------------- |
| Services sin test              | ~18                | ~900           |
| Hooks sin test                 | ~15                | ~1,200         |
| `lib/` sin test                | ~8                 | ~400           |
| Edge Functions sin `*_test.ts` | ~7                 | ~350           |
| E2E nuevos                     | 10 specs           | ~600           |
| **Total**                      | **~58 archivos**   | **~3,450 LOC** |


**Hallazgos secundarios** (positivos):

- 0 residuos JSONCargo (eliminado limpio en 12.31.0).
- 0 tests con `.skip` / `.todo` sin issue link.
- Typo detectado: `queryKeys.tiposContenedorns` y `queryKeys.puertosns` (sufijo espurio) — corregir antes de añadir tests de query keys.

---

## FASE A — Sprint 1: P0 seguridad y core (v12.37.0)

**Objetivo:** Cerrar riesgos de seguridad en edge functions + cubrir mutaciones core de cotización.

### A.1 Edge functions críticas (Deno)

- `supabase/functions/delete-user/delete_test.ts` — guard self-delete + cross-org + flujo correcto.
- `supabase/functions/invite-client-user/invite_test.ts` — body inválido, user existente vs nuevo, cliente de otra org.

### A.2 Cotización mutations

- `src/services/cotizacion/mutations/__tests__/crear.test.ts` — folio, zod validation, errores Supabase.
- `src/services/cotizacion/mutations/__tests__/update.test.ts` — serialización JSONB (`conceptos_venta`, `dimensiones_lcl/aereas`), enums.
- `src/services/cotizacion/mutations/__tests__/estado.test.ts` — transiciones válidas/inválidas.

### A.3 Conversión cotización → embarque (feature 12.30.0)

- `src/services/cotizacion/conversiones/__tests__/embarques.test.ts` — mapeo de campos + missing data.

### A.4 CRM core

- `src/services/crm/leads/__tests__/convertir.test.ts` — invariantes lead → oportunidad.
- `src/services/crm/leads/__tests__/mutations.test.ts` — CRUD + deduplicación.

---

## FASE B — Sprint 2: E2E críticos (v12.38.0)

**Objetivo:** Cobertura end-to-end real de los flujos de negocio. Los 5 specs actuales son smoke tests; ninguno valida mutaciones complejas.


| Spec                                         | Flujo                                                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `e2e/specs/06-cotizacion-wizard.spec.ts`     | Wizard cotización completo: Paso1 (FCL+cliente) → Paso2 (conceptos) → Paso3 (preview) → guardar borrador → verificar listado |
| `e2e/specs/07-cotizacion-conversion.spec.ts` | Aceptar desde portal cliente → operador convierte a embarque borrador (feature 12.30.0) → verificar mapeo                    |
| `e2e/specs/09-crm-pipeline.spec.ts`          | Lead → oportunidad → cambio etapa "Propuesta" → cotización desde oportunidad → verificar lineage                             |
| `e2e/specs/10-portal-accept-reject.spec.ts`  | Portal cliente: aceptar y rechazar cotización pendiente → verificar acuse y estado backoffice                                |


---

## FASE C — Sprint 3: Embarque y financiero (v12.39.0)

### C.1 Hooks embarque (regresión costosa)

- `src/hooks/embarque/__tests__/useEmbarqueSubmitOrchestrator.test.tsx` — orquestación create/update, idempotencia, rollback.
- `src/hooks/embarque/__tests__/useNuevoEmbarqueWizard.test.tsx` — steps, validación, vinculación cotización.
- `src/hooks/embarque/__tests__/useEditarEmbarqueWizard.test.tsx` — hydration desde DB, dirty detection.
- `src/hooks/embarque/__tests__/useEmbarqueForm.test.tsx`, `useEmbarqueDocumentosActions`, `useEmbarqueEstadoActions`, `useEventosEmbarque`.

### C.2 Hooks cotización

- `src/hooks/cotizacion/wizard/__tests__/useCotizacionWizardSteps.test.tsx`.
- `src/hooks/cotizacion/wizard/__tests__/useCotizacionWizardForm.test.tsx`.
- `src/hooks/cotizacion/mutations/__tests__/useCotizacionMutations.test.tsx`.
- `useCotizacionDetalleHandlers`, `useCotizacionConversions`.

### C.3 Services embarque

- `src/services/embarque/__tests__/eventos.test.ts` — enum `tipo_evento_tracking`.
- `src/services/embarque/__tests__/documentos.test.ts` — `resolverExpediente` (con/sin BL master).
- `src/services/embarque/queries/__tests__/{detalle,listado,conceptos}.test.ts`.

### C.4 E2E financieros

- `e2e/specs/08-nuevo-embarque-wizard.spec.ts` — wizard nuevo embarque end-to-end.
- `e2e/specs/11-facturacion-proforma.spec.ts` — embarque liquidado → proforma → facturar → hueco.
- `e2e/specs/13-embarque-liquidacion.spec.ts` — tránsito → docs → arribo → liquidación.

### C.5 Hooks facturación + portal

- `useHuecoFacturacion`, `usePagosFactura`, `useTabProformasController`.
- `usePortalCotizacionDetalle`, `usePortalDocumentDownload`.

---

## FASE D — Sprint 4: Completitud y limpieza (v12.40.0)

### D.1 `lib/domain/` sin test (quick wins)

- `__tests__/conceptosPorContenedor.test.ts` (53 LOC src).
- `__tests__/embarqueWizardRuta.test.ts` (169 LOC src).
- `__tests__/estadoResultados.test.ts` (161 LOC src).
- `__tests__/proformaAgrupacion.test.ts` (151 LOC src).

### D.2 Otros services

- `src/services/auth/__tests__/loginAudit.test.ts` (auditoría P1).
- `src/services/cliente/__tests__/crud.test.ts` (171 LOC src sin test).
- `src/services/pagos-factura/__tests__/pagos.test.ts`.
- `src/services/crm/__tests__/{oportunidades,actividades,forecast}.test.ts`.
- `src/services/crm/vincularCotizacion/__tests__/{sincronizarEtapa,propagarConversion}.test.ts`.

### D.3 Edge functions restantes

- `auditoria-snapshot-daily/snapshot_test.ts` — CRON_SECRET + idempotencia.
- `auditoria-weekly-digest/digest_test.ts` — `esc()` HTML, dry-run sin API key.
- `exchange-rates/exchange_test.ts` — caché, fallback timeout.
- `tracking-public`, `list-users`, `list-client-users` — schema + auth guard.

### D.4 E2E P1/P2

- `e2e/specs/12-admin-org-management.spec.ts` — crear org, invitar usuario, asignar rol.
- `e2e/specs/14-bitacora-audit.spec.ts` — modificar embarque → verificar bitácora.
- `e2e/specs/15-portal-documentos.spec.ts` — download con URL firmada.

---

## FASE E — Tests a borrar / consolidar

**Ninguno requiere borrado puro** (cero JSONCargo residual, cero skip/todo huérfanos). Lo que sí hace falta:


| Pares duplicados                                                                            | Acción                                                           |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `architecture-baseline.test.ts` + `architecture.test.ts`                                    | Auditar solapamiento → fusionar o documentar separación          |
| `services/__tests__/idempotency.integration.test.ts` + `lib/__tests__/idempotency.test.tsx` | Eliminar el más débil tras verificar cobertura                   |
| `financialUtils.edge.test.ts` + `financialUtils.test.ts`                                    | Mover edge cases a `describe("edge cases")` dentro del principal |
| `useAuditoriaEjecutivo.edge.test.tsx` + `useAuditoriaEjecutivo.test.tsx`                    | Consolidar (mismo anti-patrón)                                   |
| `services/crm/__tests__/computeLeaderboard.test.ts` vs `lib/crm/__tests__/`                 | Revisar solapamiento antes de borrar                             |


**Esfuerzo:** S (≤0.5 días). Recomendado hacerlo al cierre de cada sprint para no dejar deuda.

---

## Pre-requisito (antes de Sprint 1)

Corregir typo: `queryKeys.tiposContenedorns` y `queryKeys.puertosns` en `src/hooks/catalogos/{useTiposContenedor,usePuertos}.ts`. Sufijo `ns` espurio rompe el bucket de caché aunque no falle en runtime.

---

## Detalles técnicos

```text
Esfuerzo por sprint:
  Sprint 1 (A):  ~5 días   — 7 archivos, P0 seguridad/core
  Sprint 2 (B):  ~7 días   — 4 specs E2E P0
  Sprint 3 (C):  ~12 días  — 16 archivos (hooks + services + E2E)
  Sprint 4 (D):  ~8 días   — 18 archivos + 3 E2E P1/P2
  Fase E:        ~0.5 día  — consolidación duplicados

Total: ~32 días de trabajo de QA dedicado.

Cierre de cada sprint:
  - bump APP_VERSION + entrada CHANGELOG.md
  - bun run audit:tests   (higiene)
  - bun run audit:report  (baselines)
  - bunx vitest run       (suite completa)
  - bunx playwright test  (E2E)
```

## Decisión pendiente

¿Ejecutamos los 4 sprints secuencialmente, o paramos tras Sprint 1 (P0 seguridad/core) para validar antes de seguir? Ejecuta un subagente para cada false en paralelo