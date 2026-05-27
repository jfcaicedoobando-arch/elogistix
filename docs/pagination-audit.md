# Auditoría de paginación — buckets OK / CATALOG / RISK

> Generado por `scripts/audit-pagination.ts`. Total inspeccionado: **174** queries.

| Bucket | # | Significado |
|--------|--:|-------------|
| OK | 143 | Filtro por PK/FK, count-only, o ya pagina. |
| CATALOG | 25 | Tabla de catálogo acotado (allowlist). |
| RISK | 6 | Sin paginar y sin filtro acotante — candidato a .range/.limit. |

## RISK — detalle

| Archivo:línea | Tabla | Snippet |
|---------------|-------|---------|
| `src/services/auditoria/snapshots.ts:11` | `auditoria_snapshots` | `.from("auditoria_snapshots") .select("*") .gte("fecha", desdeIso) .order("fecha", { ascending: true });` |
| `src/services/crm/forecast.ts:27` | `crm_oportunidades` | `.from("crm_oportunidades") .select("id, monto_estimado, probabilidad, fecha_estimada_cierre, vendedor_email, etapa_id");` |
| `src/services/crm/forecast.ts:38` | `crm_leads` | `.from("crm_leads").select("estado, fuente"), supabase.from("crm_oportunidades").select("motivo_perdida_id, etapa_id"), supabase.from("crm_mo` |
| `src/services/crm/forecast.ts:39` | `crm_oportunidades` | `.from("crm_oportunidades").select("motivo_perdida_id, etapa_id"), supabase.from("crm_motivos_perdida").select("id, nombre"), supabase.from("` |
| `src/services/crm/leaderboard.ts:33` | `crm_oportunidades` | `.from("crm_oportunidades") .select("vendedor_email, valor_real, monto_estimado, etapa_id, fecha_cierre_real") .gte("fecha_cierre_real", inic` |
| `src/services/facturas/index.ts:115` | `conceptos_costo` | `.from("conceptos_costo") .select("*, embarques!conceptos_costo_embarque_id_fkey(expediente)") .eq("estado_liquidacion", "Pendiente") .order(` |

## CATALOG — detalle

- `src/services/admin/members.ts:33` — `organization_members`
- `src/services/admin/members.ts:38` — `organizations`
- `src/services/admin/members.ts:64` — `organization_members`
- `src/services/catalogos/index.ts:44` — `navieras`
- `src/services/catalogos/index.ts:69` — `puertos`
- `src/services/catalogos/index.ts:94` — `tipos_contenedor`
- `src/services/cliente-usuarios/index.ts:11` — `client_users`
- `src/services/configuracion/index.ts:21` — `configuracion`
- `src/services/configuracion/index.ts:33` — `configuracion`
- `src/services/configuracion/index.ts:68` — `configuracion_global`
- `src/services/crm/cliente360.ts:51` — `crm_etapas_pipeline`
- `src/services/crm/dashboard.ts:90` — `crm_etapas_pipeline`
- `src/services/crm/etapas.ts:15` — `crm_etapas_pipeline`
- `src/services/crm/etapas.ts:25` — `crm_etapas_pipeline`
- `src/services/crm/etapas.ts:61` — `crm_motivos_perdida`
- `src/services/crm/forecast.ts:18` — `crm_etapas_pipeline`
- `src/services/crm/forecast.ts:40` — `crm_motivos_perdida`
- `src/services/crm/forecast.ts:41` — `crm_etapas_pipeline`
- `src/services/crm/leaderboard.ts:28` — `crm_cuotas_vendedor`
- `src/services/crm/leaderboard.ts:36` — `crm_etapas_pipeline`
- `src/services/crm/plantillas.ts:34` — `crm_plantillas_mensaje`
- `src/services/embarque/queries/proveedores.ts:8` — `proveedores`
- `src/services/organization/index.ts:18` — `organizations`
- `src/services/planes/index.ts:21` — `planes`
- `src/services/usuario/index.ts:29` — `organization_members`

## OK — sólo conteo por archivo

- `src/services/portal/queries.ts` — 12
- `src/services/admin/stats.ts` — 8
- `src/services/proforma/queries.ts` — 7
- `src/services/crm/dashboard.ts` — 6
- `src/services/cliente/crud.ts` — 5
- `src/services/cotizacion/queries.ts` — 5
- `src/services/crm/actividades.ts` — 4
- `src/services/crm/lineage.ts` — 4
- `src/services/crm/leads/convertir.ts` — 4
- `src/services/facturas/proyeccion/fetchSources.ts` — 4
- `src/services/admin/observability.ts` — 3
- `src/services/admin/organizations.ts` — 3
- `src/services/auditoria/revisiones.ts` — 3
- `src/services/cotizacion/conversiones/duplicar.ts` — 3
- `src/services/crm/cliente360.ts` — 3
- `src/services/crm/oportunidades.ts` — 3
- `src/services/crm/search.ts` — 3
- `src/services/embarque/documentos.ts` — 3
- `src/services/facturas/exports.ts` — 3
- `src/services/facturas/huecoFacturacion/fetchSources.ts` — 3
- `src/services/proveedor/index.ts` — 3
- `src/services/auditoria/comentarios.ts` — 2
- `src/services/cliente/contactos.ts` — 2
- `src/services/cliente/relacionados.ts` — 2
- `src/services/cotizacion/conversiones/embarques.ts` — 2
- `src/services/cotizacion/costos.ts` — 2
- `src/services/crm/automatizacionesEtapa.ts` — 2
- `src/services/crm/nbaSignals.ts` — 2
- `src/services/crm/notificaciones.ts` — 2
- `src/services/crm/leads/queries.ts` — 2
- `src/services/embarque/jsoncargo.ts` — 2
- `src/services/embarque/jsoncargoFechas.ts` — 2
- `src/services/embarque/queries/conceptos.ts` — 2
- `src/services/embarque/queries/detalle.ts` — 2
- `src/services/embarque/queries/exportListado.ts` — 2
- `src/services/facturas/snapshots.ts` — 2
- `src/services/proforma/crud.ts` — 2
- `src/services/proforma/facturar.ts` — 2
- `src/services/auditoria/snooze.ts` — 1
- `src/services/auth/index.ts` — 1
- `src/services/bitacora/index.ts` — 1
- `src/services/cliente/financials.ts` — 1
- `src/services/cotizacion/conversiones/prospecto.ts` — 1
- `src/services/cotizacion/mutations/crear.ts` — 1
- `src/services/crm/comentarios.ts` — 1
- `src/services/crm/cotizacionDesdeOportunidad.ts` — 1
- `src/services/crm/cotizacionesSinRespuesta.ts` — 1
- `src/services/crm/oportunidadCotizaciones.ts` — 1
- `src/services/crm/proximasActividades.ts` — 1
- `src/services/crm/leads/mutations.ts` — 1
- `src/services/embarque/eventos.ts` — 1
- `src/services/embarque/queries/expedientes.ts` — 1
- `src/services/embarque/queries/extras.ts` — 1
- `src/services/portal/notificaciones.ts` — 1
- `src/services/tracking/index.ts` — 1
