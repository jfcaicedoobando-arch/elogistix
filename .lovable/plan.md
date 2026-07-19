
## Verificación de Fase P.3 (v13.301.89)

Revisado migración `20260719044443_..._v13_301_89_fase_p3.sql`, guardrail `garantias-fase-p3.test.ts` (9 asserts), y cambios en `conceptosCostoVinculables.ts`. Todo en verde: la RPC `materializar_factura_retencion_garantia` está `SECURITY DEFINER` con `search_path=public`, revoca `PUBLIC`/`anon`, y el trigger `trg_garantia_auto_materializar` envuelve la llamada en `EXCEPTION WHEN OTHERS` para no bloquear la transición de estado. El cliente ya no toca `conceptos_costo` desde `vincularFacturaAConceptos`; el trigger BD `tg_pfc_recalc_liq` es la única fuente de verdad.

## Auditoría Ronda 5 — Hallazgos confirmados

Se auditó portal del cliente, portal del agente, envío de correos y tracking externo. Todos los hallazgos abajo están **confirmados por lectura de código/RLS**:

### Bug 25 — Alto · Portal cliente lee `cotizaciones.*` completo

`src/features/portal/services/queries.ts:111` usa `.select("*")` sobre `cotizaciones`. La tabla tiene 81 columnas; aunque no hay `margen`/`costo` directos (viven en `cotizacion_costos`), sí filtra campos internos como `sin_desglose_costos`, notas internas de vendedor, historial de aprobaciones, snapshots, etc. Todas las demás rutas del portal usan whitelists (`PORTAL_*_COLUMNS`); esta es la única regresión.

### Bug 26 — Medio · Portal expone eventos/documentos borrados y IDs de staff

`PORTAL_EVENTO_COLUMNS` y `PORTAL_DOCUMENTO_COLUMNS` en `columns.ts` incluyen `deleted_at, deleted_by`. Los IDs UUID de usuarios internos (staff) filtran al portal del cliente. Además, las queries `fetchPortalEventos` y `fetchPortalDocumentos` no filtran `.is("deleted_at", null)`, así que el cliente ve eventos/documentos **eliminados** con leyenda de borrado.

### Bug 27 — Alto · Recordatorios de cobranza sobre facturas no vivas

`factura_recordatorios` no tiene guard trigger. Un operador puede insertar un recordatorio contra una factura **Cancelada**, **Sustituida**, en cancelación o borrador. Fase F blindó pagos/REP/NC con `assert_factura_viva_*`, pero olvidó los recordatorios. Impacta cobranza (spam a cliente por CFDI que ya no existe) y confianza del reporte de cobranza.

### Bug 28 — Bajo · `suppressed_emails` INSERT con `roles:{public}` (residuo H3)

Policy `Service role can insert suppressed emails` sigue con `TO public` (with_check restringe a `auth.role()='service_role'`, así que no hay leak real, pero incumple el patrón H3 unificado en Fase 55). Corrección trivial: `TO service_role`.

### Bug 29 — Medio · `email_unsubscribe_tokens` sin `expires_at`

Los tokens de un solo uso son válidos hasta usarse (o para siempre). Enumeración de bounces históricos posible si se filtra la tabla. Baja severidad porque son de un solo uso, pero conviene TTL 90 días para higiene.

### Bug 30 — Medio · Notificaciones huérfanas para clientes desactivados

`notificaciones_cliente` se sigue insertando aunque `client_users` ya no exista para ese `cliente_id`. Las notificaciones se acumulan sin destinatario y ensucian reportes. Falta guard en el trigger de inserción (o purga programada).

### Bug 31 — Bajo · `tracking_links.expires_at` nullable sin CHECK

La tabla permite tokens sin vencimiento (`expires_at IS NULL`). No es un leak por sí solo (los tokens son opacos y la RPC pública valida), pero la política es "tokens temporales". Debería ser `NOT NULL` con CHECK `expires_at > created_at`.

## Plan de implementación — Fase Q

Dividida en Q.1 (código cliente) y Q.2 (migración BD) para mantener CI verde en cada paso.

### Fase Q.1 (`v13.301.90`) — Portal cliente hardening (Bugs 25, 26)

1. Añadir `PORTAL_COTIZACION_DETAIL_COLUMNS` en `columns.ts` con whitelist de ~30 campos consumidos por `PortalCotizacionDetalle` (folio, cliente_*, modo/tipo, estado, moneda, subtotal/iva/total, fechas, mercancia, incoterm, comentario_cliente, embarque_id, observaciones cliente, origen/destino/puertos/aeropuertos, tipo_servicio, notas visibles al cliente).
2. Reemplazar `.select("*")` por `.select(PORTAL_COTIZACION_DETAIL_COLUMNS)` en `fetchPortalCotizacion`.
3. Quitar `deleted_at, deleted_by` de `PORTAL_EVENTO_COLUMNS` y `PORTAL_DOCUMENTO_COLUMNS`.
4. Agregar `.is("deleted_at", null)` en `fetchPortalEventos` y `fetchPortalDocumentos`.
5. Guardrail nuevo `src/features/portal/services/__tests__/portal-columns-whitelist.test.ts` que verifica: `columns.ts` no exporta `deleted_by`, `queries.ts` no contiene `.select("*")`, todas las queries del portal filtran `deleted_at IS NULL` donde aplica.

### Fase Q.2 (`v13.301.91`) — Guardas BD (Bugs 27, 28, 29, 30, 31)

Migración única con:

1. Función `assert_factura_viva_para_recordatorio(uuid)` + trigger `BEFORE INSERT ON factura_recordatorios` que bloquea si la factura no está en `FACTURA_ESTADOS_VIVOS` (Emitida, Parcialmente pagada, Vencida). Excepción explícita `LC_RECORDATORIO_FACTURA_NO_VIVA` mapeada en el cliente.
2. Recrear policy `Service role can insert suppressed emails` con `TO service_role` (drop + create).
3. `ALTER TABLE email_unsubscribe_tokens ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days')`. Ajustar `handle-email-unsubscribe/index.ts` para rechazar `now() > expires_at`.
4. Trigger `BEFORE INSERT ON notificaciones_cliente` que verifica `EXISTS (SELECT 1 FROM client_users WHERE cliente_id = NEW.cliente_id)`. Excepción `LC_NOTIF_CLIENTE_SIN_PORTAL` (no fatal — degradar a `RAISE WARNING` + `RETURN NULL` para descartar silenciosamente).
5. `ALTER TABLE tracking_links ALTER COLUMN expires_at SET NOT NULL, ADD CONSTRAINT tracking_links_expiry_futura CHECK (expires_at > created_at)`. Backfill: `UPDATE ... SET expires_at = created_at + interval '30 days' WHERE expires_at IS NULL`.
6. Guardrail `src/lib/__tests__/portales-y-correos-fase-q.test.ts` con ≥6 asserts sobre la migración (funciones, triggers, CHECK, policy update, backfill).

### Detalles técnicos

- `PORTAL_COTIZACION_DETAIL_COLUMNS` se enumera leyendo `PortalCotizacionDetalle.tsx`, `DatosGeneralesCard.tsx`, `SeccionMercanciaCotizacionDetalle.tsx`, `ResumenTotalesCotizacion.tsx`, `PortalCotizacionEstadoBanner.tsx` y `usePortalCotizacionDetalle` para no romper la UI.
- El trigger de recordatorios respeta la excepción de la Fase F: cheques manuales/históricos no aplican; los recordatorios siempre son nuevos, sin bypass.
- Migración Q.2 usa `DROP POLICY IF EXISTS ... CREATE POLICY` para la corrección H3 residual (patrón ya usado en Fase 55).
- Bump `APP_VERSION` a `13.301.90` (Q.1) y `13.301.91` (Q.2), con dos entradas en `CHANGELOG.md`.

### Fuera de alcance

- Bug 24 (Round 4) sigue refutado — el trigger `tg_pfc_recalc_liq` ya existe.
- El portal del agente (`fetchAgenteEmbarques`) usa una whitelist explícita y no expone profit; sin cambios.
- Ronda 6 (embarques 2, cierre, auditoría) queda para después de Q.2.
