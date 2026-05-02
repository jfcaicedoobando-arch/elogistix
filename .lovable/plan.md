
# Auditoría — Fase 3 completa (v8.103.0)

Convierte el módulo de Auditoría en una herramienta ejecutiva de fugas financieras y productividad operativa, sobre la base de Fase 1 (dashboard) y Fase 2 (asignación) ya entregadas.

## Qué obtiene el director general

1. Una tarjeta de **fuga financiera** que suma en MXN los embarques con margen negativo, margen bajo y proformas sin facturar.
2. **MTTR** (tiempo medio de resolución) por operador y ranking "más resuelve" vs "más pendientes".
3. **Tendencia 30 días** del score, hallazgos críticos y pendientes (línea), apoyado en snapshots diarios.
4. **Hilo de comentarios** por hallazgo (no sólo una "acción tomada" pisable).
5. **Snooze** con justificación y fecha de re-aparición (saca ruido temporal sin perder trazabilidad).
6. **Configuración** de umbrales por organización (% margen mínimo, días para proforma vencida, días sin movimiento).
7. **Digest semanal por correo** vía Resend con resumen y top fugas.

## Cambios de base de datos

Una sola migración que:

- Extiende `auditoria_revisiones` con `snoozed_until date` y `snooze_motivo text`.
- Crea `auditoria_comentarios` (revision_id, autor, contenido, timestamp) con RLS por organización (lectura tenant; escritura admin/operador; autor = `auth.uid()`).
- Crea `auditoria_snapshots` (organization_id, fecha, totales, criticos/altos/medios, score, por_regla jsonb) con `UNIQUE(organization_id, fecha)` y RLS tenant.
- Reescribe `auditoria_embarques_org()` agregando 6 reglas nuevas, sin romper el contrato actual:
  - `margen_negativo` (crítico) — utilidad MXN < 0.
  - `margen_bajo` (alto) — margen % < umbral configurable (default 5%).
  - `venta_sin_costo` (alto) — embarque con ventas y sin un solo costo cargado.
  - `costo_sin_venta` (medio) — embarque cerrado/entregado con costos pero sin venta.
  - `proforma_vencida` (alto) — proforma sin factura > N días (default 30).
  - `embarque_huerfano` (medio) — sin operador o sin movimientos en bitácora > N días (default 5).
  - Conversión a MXN usando `tipo_cambio_usd`/`tipo_cambio_eur` del propio embarque.
  - Lee umbrales desde `public.configuracion` con `categoria='auditoria'`.
  - Devuelve además bloque `umbrales` para que la UI sepa qué se aplicó.
- Crea `auditoria_capturar_snapshot(p_organization_id uuid)` (SECURITY DEFINER) para capturar el snapshot del día desde la app o desde una edge function.

## Capa de datos (services + hooks)

- `src/types/auditoria.ts`: agrega `EstadoRevision` con `snoozed_until/motivo`, tipos `AuditoriaComentario`, `AuditoriaSnapshot`, `AuditoriaUmbrales`, y nuevas reglas en el union de `RevisionRegla`.
- `src/services/auditoria/index.ts`: `fetchComentarios(revisionId)`, `insertComentario`, `fetchSnapshots(dias)`, `capturarSnapshot()`, `snoozeRevision(id, hasta, motivo)`.
- Nuevos hooks (en su carpeta + barrel `index.ts`):
  - `useAuditoriaComentarios(revisionId)` — lista + mutation insertar.
  - `useAuditoriaSnapshots(dias=30)` — para tendencia.
  - `useSnoozeHallazgo()` — mutation con bitácora.
  - `useCapturarSnapshot()` — mutation manual + invocada por digest.
- Amplía `useAuditoriaEjecutivo`:
  - **Riesgo financiero MXN** (suma de detalles parseados de las nuevas reglas) — sin red extra, deriva del payload existente.
  - **MTTR por operador** desde `auditoria_revisiones` (`asignado_at` → `updated_at` cuando `estado_revision='revisado'`).
  - **Top 5 operadores** por hallazgos resueltos y por pendientes.

## Cambios de UI

- `AuditoriaEjecutivoTab.tsx`: agrega tarjeta "Riesgo financiero MXN", grid de "Productividad de operadores" (MTTR + ranking) y `AuditoriaTendenciaChart` (recharts LineChart 30d, score y críticos).
- `MarcarRevisadoDialog.tsx`: agrega tabs internas **Acción / Comentarios / Snooze**:
  - Comentarios: lista cronológica + textarea para agregar.
  - Snooze: date picker + motivo obligatorio; al guardar, RLS-friendly, hallazgo desaparece de filtros "pendientes" hasta `snoozed_until`.
- `HallazgosTablaPaginada.tsx` / `useHallazgosTablaState.ts`: filtro por nuevas reglas; ocultar snoozed por defecto (toggle "Mostrar snoozed").
- `Auditoria.tsx`: tab por defecto pasa a `ejecutivo` cuando el rol es `admin`/`super_admin`; mantiene `tabla` para `operador`.
- Nuevo `TabAuditoria.tsx` en `src/components/configuracion/` con campos `margen_minimo_pct`, `dias_proforma_vencida`, `dias_huerfano`. Se enchufa en `Configuracion.tsx` y `useConfiguracionState.ts` siguiendo el patrón existente de `categoria='auditoria'`.

## Edge functions

- `supabase/functions/auditoria-snapshot-daily/index.ts`: itera todas las orgs activas (service role), llama `auditoria_capturar_snapshot` por cada una, registra resultado.
- `supabase/functions/auditoria-weekly-digest/index.ts`: arma el resumen ejecutivo de cada org (score actual, delta semanal, top 5 fugas, asignaciones vencidas) y lo manda a los admins de la org via Resend (gateway Lovable).
  - Si `RESEND_API_KEY` no está aún, el código no falla: hace dry-run y registra en logs. El usuario puede agregarlo después.
- Cron via `pg_cron`+`pg_net` se documenta en el changelog; no se programa automáticamente para no inyectar el anon key en una migración.

## Versionado y changelog

- `APP_VERSION` → **8.103.0** (MINOR: features nuevas, sin breaking changes).
- Entrada nueva en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts` con todos los puntos anteriores en español.

## Detalles técnicos relevantes

- **Sin red extra para tarjetas ejecutivas nuevas**: riesgo financiero, MTTR y rankings se derivan del payload de `auditoria_embarques_org()` y del cache de `useAuditoriaRevisiones`.
- **Backfill de snapshots**: la migración no rellena historial; el primer snapshot se captura al primer load del tab ejecutivo (mutation idempotente por `UNIQUE(organization_id, fecha)`), así la línea empieza a poblarse desde el día 1.
- **Compatibilidad**: el contrato JSON de `auditoria_embarques_org()` mantiene todas las claves anteriores; sólo agrega entradas en `por_regla` y un bloque `umbrales`. Ningún consumidor existente se rompe.
- **RLS**: comentarios y snapshots heredan el patrón de `auditoria_revisiones` (lectura tenant; escritura admin/operador). Snooze va dentro de `auditoria_revisiones` y reusa sus policies.
- **Snooze semántica**: un hallazgo "snoozed" sigue siendo `pendiente` para auditoría histórica, sólo se filtra en la vista por defecto (`snoozed_until > today`).
