
# Implementación de la auditoría — Loop 1

Ejecuto en este loop los ítems de mayor impacto. Los 15+ refactors restantes de componentes/hooks grandes quedan en task tracker para loops siguientes (hacerlos todos sin verificar entre lotes es riesgoso).

## En este loop

### P0 — Capa de datos CRM
- **Nuevo** `src/services/crm/index.ts`: `fetchOportunidadCotizaciones`, `fetchLeadLineage`, `fetchOportunidadCotsLineage`, `fetchEmbarquesByIds`, `fetchLeadResumen`, `fetchLeaderboardRaw`, `computeLeaderboard` (pura), `insertCotizacionDesdeOportunidad`, `actualizarEtapaOportunidad`.
- **Nuevos hooks** `src/hooks/crm/`: `useOportunidadCotizaciones`, `useLineage` (lead + op), `useLeaderboardVendedores`, `useCrearCotizacionDesdeOportunidad`.
- **Refactor** (quitar `supabase.from(...)`):
  - `src/components/crm/OportunidadCotizacionesList.tsx`
  - `src/components/crm/LineageCard.tsx`
  - `src/components/crm/LeaderboardVendedores.tsx`
  - `src/pages/crm/OportunidadDetalle.tsx`

### P1 — Partir `useLeads.ts` (382 líneas)
Crear módulo `src/hooks/crm/leads/`:
- `constants.ts` — `LEAD_ESTADOS`, `LEAD_FUENTES`, tipos, `LEAD_COLUMNS`.
- `queries.ts` — `useLeads`, `useLead`.
- `mutations.ts` — `useCrearLead`, `useActualizarLead`, `useEliminarLead`.
- `bulk.ts` — `useActualizarLeadsBulk`, `useEliminarLeadsBulk`, `useCrearLeadsBulk`.
- `convertir.ts` — `useConvertirLead` (+ service helper `services/crm/convertirLead.ts` para el flujo cliente/oportunidad).

`src/hooks/crm/useLeads.ts` queda como **barrel re-export** para no tocar los 7 consumidores existentes. Cada archivo ≤200 líneas.

### P2 — Logger estandarizado
- **Nuevo** `src/lib/observability/logger.ts`: wrapper `logger.warn/error/info/debug` que respeta `import.meta.env.MODE` y reemite a `logClientError` (Supabase) en producción. Estilo prefijo `[modulo]`.
- Reemplazar las 11 ocurrencias de `console.warn|error` productivos por `logger.*`. (No `console.log`.)

### Versión + changelog
- `APP_VERSION` → **11.13.0**.
- Entrada en `recentChangelog` y `chunk0` (mantener 10 más recientes).

### Verificación
- `bunx vitest run` (esperado: 589+ tests verdes).
- Build automático del harness.

## Out of scope en este loop (siguientes)

Marcados en task tracker, los abordo en loops separados:

- **P1 — Componentes > 200 líneas** (14 archivos): LeadDetalle, NuevaOportunidadDialog, DiagnosticoHealthPanel, TabDocumentos, BitacoraActividad, Facturacion, DashboardStatusCards, ClienteDetalle, NuevoLeadDialog, Proveedores, Usuarios admin-org, ProveedorDetalle, Leads, LineageCard.
- **P1 — Hooks > 200 líneas** (7 archivos): `useNuevoEmbarqueWizard`, `useAuditoriaRevisiones`, `useEmbarquesPageState`, `useAuditoriaEjecutivo`, `useJsonCargoTracking`, `useCrmDashboard`, `useTrackingLiveCard`.
- **P2 — Partir barriles** `services/*/index.ts` grandes (auditoria, proveedor, usuario, facturas, catalogos, reportes).
- **P2 — Partir libs grandes** (`lib/parsers/dashboard.ts`, `lib/domain/proyeccionFacturacion.ts`, `lib/formatters/index.ts`).
- **P3 — Tests de componentes React**, extracción de `routes.tsx`.
- **TODO/FIXME cleanup**: ya verificado — no hay matches reales, los 15 detectados eran falsos positivos (`TODOS` español, `?estado=XXX` placeholder JSDoc, changelogs).

## Detalles técnicos

- Cero cambios en RLS, schema, edge functions, `integrations/supabase/*`.
- `useLeads.ts` queda como barrel; no se requiere tocar páginas/componentes que importan de él.
- Logger pasa por `logClientError` ya existente (no se duplica observability).
- En `OportunidadDetalle.tsx` la creación de cotización se mueve a `useCrearCotizacionDesdeOportunidad`; el `toast` queda en la página.

## Verificación de éxito

- 0 ocurrencias de `@/integrations/supabase/client` en `src/components/crm/**` y `src/pages/crm/**` (excepto si el orquestador requiere `useAuth`, que ya vive en context).
- `src/hooks/crm/useLeads.ts` < 30 líneas (solo re-exports).
- Cada nuevo archivo < 200 líneas.
- Vitest verde.
