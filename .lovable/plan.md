## Estado actual de la cobertura

- **47 archivos de tests** sobre 727 archivos fuente (6.5%).
- **Bien cubierto:** `lib/domain`, `lib/financial`, `lib/mappers`, `lib/parsers`, `lib/csv`, auditoría (`useAuditoriaEjecutivo`, `useAuditoriaRevisiones`, `useHallazgosTablaState`), DataTable (e2e/perf/regression), changelog, formatters, permisos.
- **Sin cobertura significativa:**
  - **CRM completo** — 46 archivos, **0 tests**. Acabamos de cerrar los sprints F/G/H y todo va sin red.
  - **Edge functions** — 11 funciones (`list-users`, `create-user`, `delete-user`, `invite-client-user`, `client-csf-extract`, etc.), **0 tests Deno**.
  - **Hooks de embarques/cotizaciones/facturación** clave (más allá de `useEmbarquesListData`).
  - **Servicios de Supabase** (apenas `csfService`, `tracking`, `idempotency`).

## Propuesta: dos sprints de testing (sin tocar features)

### Sprint T1 — Lógica pura del CRM (alta ROI, sin mocks pesados)

Tests unitarios de funciones puras y reducers del CRM, donde los bugs son más caros:

1. `src/hooks/crm/useForecastReportes` — cálculo ponderado del forecast, agrupación por etapa.
2. `src/hooks/crm/useProximasActividades` — agrupación batch por entidad, marcado vencido/hoy.
3. `src/hooks/crm/useCliente360` — totales abierto/ganado, última cotización/embarque.
4. `src/lib/crm/plantillas` (si existe) o helpers de variables `{{contacto}}`/`{{empresa}}` en `PlantillaSelector`.
5. `src/lib/domain/crmOportunidad.ts` (si existe) o extraer puras desde componentes — scoring de leads, transición de etapa, cálculo de probabilidad por defecto.

### Sprint T2 — Edge functions críticas (Deno tests)

Tests con `deno test` para las funciones que ya causaron incidentes en producción:

1. `**list-users**` — happy path admin, admin de org (filtra por org), miembro no-admin (recién relajado en 11.7.3), usuario sin org (403), token inválido (401).
2. `**create-user**` — admin OK, no-admin 403, email duplicado, password débil.
3. `**delete-user**` — admin OK, no-admin 403, intentar borrarse a sí mismo.
4. `**_shared/auth.ts**` — `authenticate` y `checkAdminAccess` con mocks del SupabaseClient.

Usaríamos `https://deno.land/std/dotenv/load.ts` + el `.env` raíz como indica la guía.

### Lo que NO entra en estos sprints

- Tests E2E del navegador (Playwright/Cypress) — requiere setup nuevo.
- Tests de UI/snapshot de componentes CRM completos — frágiles y costosos.
- Refactor de código existente — sólo añadir tests.

## Pregunta para ti

¿Arranco con **T1 (CRM puro)**, **T2 (edge functions)**, **ambos**, o prefieres que enfoque otro módulo (embarques, cotizaciones, facturación)? También puedo subir el umbral global pidiéndote definir un objetivo (p.ej. ≥15% coverage en 2 sprints).

Genera ambos tests