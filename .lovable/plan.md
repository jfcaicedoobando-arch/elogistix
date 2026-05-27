# Auditoría arquitectónica — Libre Carga (estado 11.59.1)

> **Bloque A cerrado** entre 11.54.0 y 11.59.1. Diagnóstico original archivado
> en `mem://audit/pendings`. Este documento refleja el estado **actual** post
> migración + plan vigente para Bloques B/C/D.

## 1. Métricas baseline (post Bloque A)

| Métrica | 11.45.0 (diagnóstico) | 11.59.1 (actual) | Meta |
|---|---:|---:|---:|
| Hooks con `@/integrations/supabase/client` directo | 28 | **0** ✅ | 0 |
| Components con Supabase directo | 1 | **0** ✅ | 0 |
| Contexts con Supabase directo | 5 | **0** ✅ | 0 |
| Pages con Supabase directo | 0 | **0** ✅ | 0 |
| Archivos productivos >200 líneas (no shadcn) | 2 | **3** | 0 |
| `any` en código productivo | 0 | **0** ✅ | 0 |
| `console.*` en código productivo | 0 | **0** ✅ | 0 |
| Suites de tests en `services/` | — | **18** ✅ | ≥10 |
| Total tests | 709 | **716** | crecer |
| Subdominios en `services/` | 25 | **29** | — |
| `as` casts totales | 458 | **720** (37 HIGH) | bajar HIGH |

> Los 10 imports restantes de `@/integrations/supabase/types` desde hooks y
> components son **type-only** (`Tables`, `Enums`, `TablesInsert`,
> `Database`) — permitidos por contrato, no rompen capas.

## 2. Bloque A — ✅ CERRADO (11.54.0 → 11.59.1)

Migrados 33 archivos en 6 lotes a `services/{admin,crm,portal,embarque,auth,organization}/`:

- **Lote 1 (admin):** `useAppLogs`, `useAppLogsHealth`, `useAlertasSistema`.
- **Lote 2 (portal/auditoría):** `portal/useNotificacionesCliente`, `auditoria/revisiones/query`.
- **Lote 3 (CRM core):** `useOportunidades`, `useActividades`, `useCliente360`, `useCrmDashboard`, `useEtapasPipeline`, `useNextBestActions`, `usePlantillasMensaje`, `useComentariosOportunidad`, `useCrmSearch`, `useCrmNotificaciones`, `useProximasActividades`, `useActualizarActividadNotas`.
- **Lote 4 (CRM leads/forecast/automatizaciones):** `crm/leads/{queries,mutations,bulk,convertir,convertirHelpers}`, `useAutomatizacionesEtapa`, `automatizacionesEtapaActions`, `useForecastReportes`, `oportunidadPayload`, `leadPayload`.
- **Lote 5 (embarque):** `embarque/mutations/useUpdateEmbarque`, `useJsonCargoTracking`, `useJsonCargoBolLookup`, `TabTracking`.
- **Lote 6 (auth/org):** `AuthContext`, `OrganizationContext`, `useAuthSession`, `useAuthProfile`, `useLoginAudit` → `services/auth/{session,loginAudit}` + `services/organization`.

Test de arquitectura (`src/lib/__tests__/architecture-baseline.test.ts`) tiene
el `Set` de excepciones vacío. Lint clean en `src/`.

## 3. Pendiente — Bloques B/C/D

### Bloque B — Power-of-10 y barrels
- **B5.** Partir `src/lib/query/index.ts` (256 líneas) en
  `queryClient.ts` + `persister.ts` + `keys.ts` + `gc.ts`.
- **B6.** Refactor `components/crm/ImportarLeadsCsvDialog.tsx` (202) →
  hook `useImportarLeadsCsv` + sub-componentes preview/errores.
- **B6b.** Refactor `components/shared/BulkImportDialog.tsx` (201) en la
  misma línea (extraer controller + sub-componentes).
- **B6c.** Refactor `services/crm/leads.ts` (210) — dividir por sub-acción
  (`queries.ts` + `mutations.ts` + `bulk.ts` ya existen como hooks; mover
  agrupaciones puras a `lib/domain/crm/leads`).
- **B7.** Documentar excepción `components/ui/sidebar.tsx` (637, shadcn) en
  `docs/power10-baseline.md`.
- **B8.** Auditar los dos `no-restricted-imports: "off"` en `eslint.config.js`
  y acotar a archivos shadcn/legacy con justificación.

### Bloque C — Consistencia
- **C9.** Renombrar helpers no-hook en `hooks/crm/` (`*Actions.ts`,
  `*Helpers.ts`, `*Payload.ts`) o moverlos a `lib/domain/crm/`. (Parcialmente
  hecho en Lote 4: `oportunidadPayload`, `leadPayload` ya re-exportan desde
  `lib/`.)
- **C10.** Auditar 25 `style={{…}}` inline → tokens Tailwind / semánticos.
- **C11.** Homogeneizar prefijos en duplicados (`Configuracion.tsx`,
  `TabFacturacion.tsx`).

### Bloque D — Opcional
- **D12.** Dividir `routes.tsx` (188) en `routes/{admin,portal,crm,public}.tsx`.
- **D13.** Vigilar archivos 180–200 líneas (lista en mem://audit/pendings).
- **D14.** Test arquitectónico adicional que falle si `hooks/` o `contexts/`
  importan `@/integrations/supabase/client`. **YA EXISTE** vía
  `architecture-baseline.test.ts` + `scripts/audit-architecture.ts`.
- **D15.** Reporte CI automático con violaciones de capa y archivos
  oversized.

## 4. Orden recomendado

Mayor ROI: **B6 + B6b + B6c + B5** (los 3 oversized + el split de
`lib/query`). Después C9/C11 (cosmético) y dejar D para cuando haya hueco.
