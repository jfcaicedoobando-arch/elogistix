# Roadmap post-release · Olas 1–3

Fuente: `instrucciones-lovable-release-2.md` + estado actual verificado en `CHANGELOG.md` (v13.312.20). El release C1 ya cerró (v13.312.18); lo que queda es deuda no bloqueante rastreada.

## Estado actual (verificado)

- **Ola 1 · item 2** (RHF en 4 formularios): 2/4 hechos → `SignupForm`, `ResetPassword` (v13.312.19). Faltan los 2 pesados de CxP.
- **Ola 1 · item 3** (`useMutationWithFeedback`): 6/6 del primer batch hechos en portal/notificaciones/auditoría (v13.312.20). Faltan los 6 focos de alto volumen que menciona el doc.
- **Ola 1 · item 1** (wizard hidratación): 0/1. Es la pieza más frágil del frontend.
- **Ola 2** y **Ola 3**: 0 avance.

## Ola 1 — cerrar pendientes (prioridad alta)

**A. Wizard hidratación** — `useHidratacionEditarEmbarque.ts`
- Hoy: 4 `useEffect` + 4 flags + refs mutados en render (líneas 51-58) + deps `[p]`. Frágil, causa loops.
- Fix: reemplazar por `defaultValues`/`reset` de RHF alimentado del query del embarque en `useEditarEmbarqueWizard`.
- Red de seguridad **antes** de tocar: tests conductuales por tab del wizard (Datos generales, Ruta, Contenedores, Costeo, Documentos) que fijen el comportamiento actual de hidratación.

**B. Formularios CxP a RHF** — `useNuevaFacturaProveedorForm` (10 `useState`) + `useEditarFacturaProveedorForm` (5 `useState`)
- El schema zod (`buildFacturaFormSchema`) y validador (`validateFactura`) ya existen — solo falta migrar el estado a `useForm`.
- Complicación: el hook orquesta CFDI XML parse + reducer de vínculos + PDF-IA + TC-DOF. Migrar el form no puede romper esos side effects.
- Estrategia: extraer el estado no-form (parse/vinculos/refs) fuera del `useForm`; el form solo gobierna campos editables.
- Red: snapshot conductual del flujo CFDI (subida XML → autopoblado → guardado) antes del refactor.

**C. Migración de 6 hooks de alto volumen a `useMutationWithFeedback`** — foco de fugas de error crudo
- `useCosteoTarifas` (6 mutaciones), `useCotizacionMutations` (5), `useClientes` (5), `useDocumentoEmbarqueMutations` (4), `useTimbrarFactura` (4), `useNotasCreditoProveedor` (4) = 28 callsites de los 193 totales.
- Mecánico: aplicar el patrón ya usado en portal/notificaciones. Tests conductuales por hook (éxito → invalidate + toast; error → `notifyError` con título correcto).
- Excluir casos con branching complejo (mapeo 402/429, éxitos parciales) como se hizo con `useExplicarHallazgo`/`useMarcarRevisadosBulk`.

## Ola 2 — 2–4 semanas post-release

**D. Complexity disables sin justificar (3)** — `DialogTimbrarFactura` (CC=27), `TabPnl` (CC=27), `TabCierre` (CC=18): refactor o comentario justificante. Limpiar 3 entradas muertas de la allowlist (`FacturasMasivasToolbar`, `dashboardEjecutivo`, `facturapi-emitir` ya no violan). Burn-down real de `describirEntrada` (CC=24, hoy solo suprimido).

**E. Prop drilling residual (3 componentes)** — `EmbarqueDetalleHeaderActions` (23 props → consumir `useEmbarqueEstadoActions` directo), `PagoProveedorFormBody` (24), `TabFacturasEmitidas` (23).

**F. Shim `lib/domain/bitacora/registrar.ts`** — migrar los 12 callers productivos a `@/services/bitacora/registrar` y borrar el shim.

**G. Backend chico** — registrar 5 helpers (`_audit_embarques_*`, `_convertir_proformas_*`, `_crear_embarque_*`, `_calcular_demoras_*`) en `schema-invariants.sql`; sincronizar header/grants del canónico `supabase/schema/cxp/guard_pago_proveedor.sql` (baseline `20260723223436` + REVOKE/GRANT del H6).

**H. Regla H7 en `scripts/audit-migrations.ts`** — todo `RAISE` nuevo sin `LC_`+`ERRCODE` falla el audit (cobertura LC_ estancada en 21.5%).

## Ola 3 — boy-scout (cuando haya oxígeno)

**I.** 4 clones jscpd: `ConceptoRowMXN/USD` (parametrizar por moneda), `Portal*MobileFilters`, `CosteoNavieras ↔ AgenteGarantias`, `BandejaPorEnviar ↔ Timbrar`. Fusionar `MobileFilterSheet`/`MobileFiltersSheet`.

**J.** Knip burn-down (22 exports / 106 tipos); quemar SONNER-LEGACY (82 archivos en olas); CROSS_FEATURE (44 entradas, top: admin→configuracion 8, profit→dashboardEjecutivo 8).

**K.** Layout: `dashboardEjecutivo` a convención única; `compras/matching` → `compras/domain/matching`; absorber `crm/lib` + `marketing/lib`.

**L.** Cosméticos: flags redundantes `--coverage.thresholds.*=0`; re-export huérfano `LC_CODE_MESSAGES`; `.env` a `.gitignore`; Prettier; react-hooks v7 por dominio; memo trivial `Cxp.tsx:64`; `Onboarding`/`ClaimPendingBanner` → `useMutationWithFeedback`.

## Guardarraíles activos (respetar en cada PR)

- Ciclos type-only: **≤15** (madge). Rechazar PR que agregue uno nuevo.
- Toda migración que toque triggers/funciones debe actualizar `supabase/tests/schema-invariants.sql` en el mismo PR (CI truena si no).
- Cada Ola bumpea `APP_VERSION` + entrada en `CHANGELOG.md` con analogía y "pendientes" explícitos si aplica.

## Orden sugerido de ejecución

1. **C** primero (mecánico, alto ROI en telemetría de errores).
2. **B** con red conductual (bloquea confianza en CxP).
3. **A** con red conductual por tab (mayor riesgo, mejor último de Ola 1).
4. Ola 2 en el orden **G → H → D → E → F** (backend/CI antes que refactors visuales).
5. Ola 3 oportunista.

## Nota de persistencia

El plan vive en `.lovable/plan.md`, que está en `.gitignore` — se pierde al cerrar sesión. Si querés que persista en el repo, avisá y quito la entrada del `.gitignore`.
