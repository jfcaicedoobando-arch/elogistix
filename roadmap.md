# Roadmap

## Auditoría v14-2 (40 hallazgos)
- [x] Olas 1–4 (críticos, altos, medios/bajos masivos) — v13.798–13.801
- [x] Ola 5 y 6 parcial (A-1, A-6, A-7, M-8, M-10, B-10, M-11) — v13.802
- [x] Ola 6 frontend (B-8, M-14) — v13.803
- [x] Técnicos bajo riesgo: B-17, B-19 (verificados ya cubiertos), B-20 (RFC SAT) — v13.804

## Decisiones de producto (cerradas en v13.805)
- [x] M-12 Conflicto entre pestañas en autosave de cotización (tabId + aviso)
- [x] M-13 Borrador 24 h en wizard de embarque (autosave + restauración + conflicto)
- [x] M-15 Límite de crédito fail-closed con override por rol (gerencia/finanzas)
- [x] B-3 Three-way match documentado como 2 vías por diseño (docs/flujo-cxp-aprobacion.md)
- [x] B-4 PUE: sólo liquidación total (trigger BD + bloqueo UI)

## Pendiente
- [ ] B-21 Tracking automático naviera (gap de alcance, evaluar)

## YAGNI · Ola 10 (v13.808.0)

Hecho:
- Composite action `restore-rls-snapshot` (des-duplica 4 jobs de `rls-tests.yml`).
- Retiro de `backfill-cxp-buzon` (edge function de un solo uso) y de la RPC `reconciliar_conceptos_facturados_legacy`.
- `purge_app_logs_old()` agendada en cron (01:30 CDMX) y cerrada a service_role.

Pendiente (decisión de producto):
- `auditoria-snapshot-daily`: existe la función pero no está agendada — programar o retirar.
- `tracking_externo` / `tracking_intentos`: mantener sólo si se hace B-21 (Terminal49); si no, retirar.
- Redirects legacy de rutas: retirar cuando haya analítica de uso real.
- Flag `inline` de `ProtectedRoute`: simplificar (un solo consumidor real).

## Pulido v13.817.0
- [x] Hallazgo 6: mensajes en español MX en errores de `facturapi-emitir`
- [x] Ola lint: complejidad en cotizacionDraftStorage, update.ts, NuevoEmbarque, useTraspasoForm
