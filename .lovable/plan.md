# Plan: Cerrar huecos de cobertura con subagentes en paralelo

## Diagnóstico actual

- **149 archivos de test** vs **1,087 fuentes** (~14% archivos con test). Vitest + v8 configurados y verdes.
- Capas fuertes: `lib/financial`, `lib/parsers`, `lib/formatters`, `lib/mappers`, `lib/domain` (13/19), `features/embarques/domain` (9/10).
- Capas débiles principales:
  - `src/services/**`: **107 fuentes / 32 tests** — 22 subcarpetas con **0 tests** (auditoria, tesoreria, presupuesto, profit, cxp, comisiones, configuracion, storage, etc.).
  - `src/features/embarques/hooks/**`: **36 / 2** (toda la orquestación del wizard sin red).
  - `src/hooks/**`: **160 / 19** (hooks de página y formularios).
  - `src/contexts/**`: **3 / 0** (Auth, Organization, Theme).
  - `src/components/**`: prácticamente sin tests salvo `shared/dataTable` y `auditoria`.

## Estrategia

Seis lotes **disjuntos por carpeta** para evitar conflictos al editarse en paralelo. Cada lote = 1 subagente (`acp_subagent--spawn_agent`, modelo `fast`, salvo lote 4 que usa `capable`). Meta por lote: **+15–25 archivos de test nuevos**, sin tocar código de producción salvo refactors menores para testabilidad (extraer helpers puros).

**Meta global**: pasar de ~14% a ~30% de archivos con test adyacente, priorizando módulos con lógica de negocio (no UI puramente presentacional).

### Convenciones para todos los lotes

- Reutilizar `src/services/__tests__/_supabaseChainMock.ts` (patrón `loginAudit.test.ts`).
- Tests adyacentes en `__tests__/` con nombre `<archivo>.test.ts(x)`.
- Cumplir Power of 10 + `scripts/audit-tests.ts` (sin `.skip`/`.only` sin issue, sin títulos duplicados).
- No tocar `src/integrations/supabase/{client,types}.ts`, ni `.env`, ni `config.toml`.
- Cada lote actualiza **su** entrada en `CHANGELOG.md` y bumpea `APP_VERSION` (patch) en un commit final consolidado por el agente principal — los subagentes **no** tocan changelog para evitar conflicto de merge; reportan qué versión sugieren.

---

## Lote 1 — `src/services/` (financiero/operativo) [fast]

Carpetas: `tesoreria/`, `presupuesto/`, `profit/`, `cxp/`, `comisiones/`, `pagos-factura/` (ampliar).
Objetivo: cubrir queries, mutaciones y cálculos derivados. Mock Supabase con chain mock; validar shape de payloads, manejo de `error`, y RLS-friendly inserts (no usar `service_role`).
Entregable: ~20 archivos de test, 1 helper compartido si aparece duplicación.

## Lote 2 — `src/services/` (catálogos + admin) [fast]

Carpetas: `auditoria/`, `bitacora/`, `catalogos/`, `configuracion/`, `organization/`, `cliente-usuarios/`, `usuario/`, `planes/`, `notificaciones/`, `storage/`, `search/`, `tracking/`, `csf/`, `dashboard/`, `operaciones/`, `reportes/`, `proveedor/`, `admin/` (ampliar de 1→6).
Objetivo: smoke + happy/error path por servicio. Verificar nombres de tabla, columnas seleccionadas (regla de "explicit column constants"), y propagación de errores.
Entregable: ~25 archivos de test.

## Lote 3 — `src/features/embarques/hooks/` [fast]

Hoy 2/36. Focalizar **hooks puros / con lógica** (no los meramente compositivos):
`useEmbarqueForm`, `useEmbarquesFilters`, `useEmbarqueFinancials`, `useEditarEmbarqueWizard`, `useNuevoEmbarqueWizard`, `useEmbarqueSubmitOrchestrator`, `useContenedoresInfoMap`, `useEmbarqueDocumentosActions`, `useEmbarqueEstadoActions`, `useTrackingLinks`, `useProformaDialog`, `useDialogGenerarProformaController`, `useCotizacionHydration`, `useEmbarquesPageState`.
Usar `@testing-library/react` `renderHook` + `QueryClientProvider` wrapper (crear `src/test/utils/queryWrapper.tsx` si no existe).
Entregable: ~14 tests + 1 wrapper compartido.

## Lote 4 — `src/hooks/` de dominio [capable]

Hooks con lógica fuera de embarques: `hooks/cotizacion/`, `hooks/facturacion/`, `hooks/configuracion/`, `hooks/portal/`, `hooks/crm/`, `hooks/auditoria/`, `hooks/shared/` (ampliar). Hoy 19/160.
Priorizar los que contengan cálculo, debouncing, paginación servidor, o sincronización RHF (`setValue` + `trigger` por memoria de proyecto). Saltar wrappers triviales de `useQuery`.
Entregable: ~20 tests. Modelo `capable` porque requiere entender RHF + React Query.

## Lote 5 — `src/contexts/` + `src/lib/` huecos [fast]

- `contexts/`: `AuthContext`, `OrganizationContext`, `ThemeContext` con mocks de `supabase.auth` (sesión / `onAuthStateChange` + cleanup obligatorio por memoria).
- `lib/crm/` (7 sin test): `cliente360`, `dashboardAggregates`, `forecast`, `forecastBuckets`, `leadEditDirty`, `nextBestActions`, `proximasActividades`, `oportunidadFormHelpers`/`State`/`Payload`.
- `lib/domain/` faltantes (6): `auth`, `bitacoraDescripcion`, `conceptosPorContenedor`, `configuracion`, `errorCatalog`, `validationFormat`.
- `features/embarques/services/` faltantes: `documentos.ts`, `eventos.ts`, `dashboardOperador.ts`, `columns.ts`, `mutations.ts`.
Entregable: ~22 tests.

## Lote 6 — Componentes con lógica + generators/pdf helpers [fast]

- `src/generators/`: `layoutContable.ts`, `estadoCuentaPdf.ts`, helpers de `cotizacion/` (`conceptosTables`, `datosGenerales`) — sólo lógica pura, no render de PDF.
- `src/pdf/documents/proformaShared.ts`, `src/pdf/emisor.ts`.
- Componentes con lógica no trivial detectables por `grep -l "useMemo\|useCallback\|useState" src/components/**/*.tsx | head` — limitar a 8 representativos (filtros, tablas custom, validadores inline).
- Migrations RLS: añadir un test que valide presencia de `GRANT` por cada `CREATE TABLE` en `supabase/migrations` (memoria del proyecto) — script + test arquitectural.
Entregable: ~15 tests + 1 test arquitectural de migrations.

---

## Ejecución

```text
spawn_agent(lote 1) ─┐
spawn_agent(lote 2) ─┤
spawn_agent(lote 3) ─┼─► esperar notificaciones ─► agente principal:
spawn_agent(lote 4) ─┤    - corre `bun run test` completo
spawn_agent(lote 5) ─┤    - corre `bun run audit:tests`
spawn_agent(lote 6) ─┘    - bumpea APP_VERSION + CHANGELOG.md (entrada única consolidada)
```

System prompt por subagente incluye:
- Convenciones arriba + ruta de `_supabaseChainMock`.
- Restricción de carpetas (sólo su lote).
- "No editar `CHANGELOG.md` ni `appVersion.ts`; reportar conteo de tests añadidos y archivos cubiertos".
- "Si un archivo requiere refactor >30 líneas para ser testable, **no refactorizar**: reportarlo como pendiente y saltar".

## Fuera de alcance

- E2E Playwright (ya existe en `e2e/`, se cubre por separado).
- Tests visuales / snapshot de PDFs renderizados.
- Edge functions Deno (suite ya separada en `supabase/functions/**/*_test.ts`).
- Subir thresholds en `vitest.config.ts` — se hará en PR posterior una vez estabilizada la nueva línea base.

## Entregable final

- ~115 archivos de test nuevos.
- Reporte por lote: archivos cubiertos, % estimado de la carpeta, pendientes.
- Una sola entrada de changelog (`[X.Y.Z]`) describiendo la oleada de cobertura.
