# Actualización de documentación MD

Tras la migración del Bloque A (11.54.0 → 11.59.1) varios documentos quedaron desfasados. La métrica clave que rompe casi todos: **hooks/contexts/components con Supabase directo = 0** (antes 28 + 5 + 1).

## Archivos a actualizar (prioridad alta)

### 1. `.lovable/plan.md` — **muy desfasado**
- Diagnostica "28 hooks con Supabase directo en CRM/Auth/Embarque" → hoy **0**.
- Lista archivos a migrar que ya están en `services/crm/*`, `services/embarque/tracking`, `services/auth/*`.
- Acción: marcar Bloque A como ✅ cerrado, dejar sólo B/C/D como pendientes, actualizar tabla de métricas baseline.

### 2. `docs/architecture-map.md`
- Encabezado "Documento vivo (P2.11, generado en 11.45.0)" → bump a 11.59.1.
- Confirmar que la tabla por dominio refleja `services/crm/{leads,oportunidades,actividades,pipeline,automatizaciones,…}` y `services/auth/{session,loginAudit}`, `services/organization`.

### 3. `ARCHITECTURE.md`
- "Última revisión: v8.206.0 — 2026-05-18" → bump a 11.59.1.
- Reafirmar: "0 hooks/contexts/components tocan Supabase directamente" (antes era sólo pages).
- Actualizar conteo de suites en `services/` (≥18).

### 4. `docs/auditoria.md`
- Cabecera "v8.118.4" → versión actual o quitar versión específica.
- Revisar que el mapa de capas no mencione hooks llamando Supabase directo.

### 5. `docs/power10-baseline.md`
- "545 archivos de src/" → ~960 (creció el proyecto).
- Refrescar métricas (#4, #5, #3, #2) corriendo `scripts/audit-power10.ts`.

### 6. `docs/tests-audit.md`
- "v11.39.0 · 108 archivos / 724 tests" → bump a conteo actual (se agregaron suites en `services/{crm,embarque,auth,organization}`).

### 7. `docs/cast-audit.md`
- Fecha 2026-05-08, 458 casts → re-correr `scripts/audit-casts.ts` y publicar nueva tabla.

### 8. `docs/strict-mode-roadmap.md`
- Estado "~559 casts, Fase A 8.124.0" → alinear con el cast-audit refrescado y marcar avance de fases si aplica.

## Archivos que NO requieren cambio

- `README.md` — apunta a `appVersion.ts` y al Changelog dinámico; correcto.
- `docs/operations.md`, `docs/backups-rollback.md`, `docs/security-checklist.md` — describen procedimientos estables.
- `docs/tables.md`, `docs/datatable-columndef-guide.md`, `docs/refactor-tanstack-summary.md`, `docs/datatable-perf-audit.md`, `docs/migracion-tabla-fase2.md` — congelados tras 10.x.
- `docs/linter-warnings.md` — refleja estado de warnings vigentes.
- `docs/integrations/jsoncargo-api.md`, `e2e/README.md`, `src/components/ui/README.md`, `supabase/tests/rls/README.md`, `CHANGELOG.md` — vigentes.

## Ejecución sugerida

Un solo bump de versión (patch 11.59.2) con entrada única en `CHANGELOG.md`:
"docs: refresh post-Bloque A (plan, architecture-map, ARCHITECTURE, auditoria, power10, tests-audit, cast-audit, strict-mode-roadmap)".

Si querés, lo aplico todo de una vez al pasar a build, o lo dividimos en dos PRs (crítico: 1-4; métricas: 5-8).
