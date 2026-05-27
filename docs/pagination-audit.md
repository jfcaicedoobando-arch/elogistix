# Auditoría de paginación — buckets OK / CATALOG / RISK

> Generado por `scripts/audit-pagination.ts`. Total inspeccionado: **174** queries.

| Bucket | # | Significado |
|--------|--:|-------------|
| OK | 119 | Filtro por PK/FK, count-only, o ya pagina. |
| CATALOG | 9 | Tabla de catálogo acotado (allowlist). |
| RISK | 46 | Sin paginar y sin filtro acotante — candidato a .range/.limit. |

## RISK — detalle

| Archivo:línea | Tabla | Snippet |
|---------------|-------|---------|
| `src/services/admin/members.ts:33` | `organization_members` | `.from("organization_members") .select("user_id, role, organization_id") .order("user_id");` |
| `src/services/admin/observability.ts:71` | `app_logs` | `.from("app_logs") .select("*", { count: "exact" }) .order("ts", { ascending: false });` |
| `src/services/admin/stats.ts:30` | `embarques` | `.from("embarques").select("organization_id"), supabase.from("cotizaciones").select("organization_id"), ]);` |
| `src/services/admin/stats.ts:31` | `cotizaciones` | `.from("cotizaciones").select("organization_id"), ]);` |
| `src/services/auditoria/revisiones.ts:6` | `auditoria_revisiones` | `.from("auditoria_revisiones") .select("*") .order("created_at", { ascending: false });` |
| `src/services/auditoria/snapshots.ts:11` | `auditoria_snapshots` | `.from("auditoria_snapshots") .select("*") .gte("fecha", desdeIso) .order("fecha", { ascending: true });` |
| `src/services/catalogos/index.ts:44` | `navieras` | `.from("navieras").select("*").order("name");` |
| `src/services/catalogos/index.ts:94` | `tipos_contenedor` | `.from("tipos_contenedor").select("*").order("name");` |
| `src/services/cliente/crud.ts:110` | `clientes` | `.from("clientes") .select("id, nombre") .order("nombre");` |
| `src/services/configuracion/index.ts:68` | `configuracion_global` | `.from("configuracion_global") .select("*") .order("categoria") .order("clave");` |
| `src/services/cotizacion/queries.ts:37` | `cotizaciones` | `.from("cotizaciones") .select(COTIZACION_LIST_COLUMNS) .order("created_at", { ascending: false });` |
| `src/services/cotizacion/queries.ts:48` | `cotizaciones` | `.from("cotizaciones") .select(COTIZACION_ACEPTADA_COLUMNS) .eq("estado", "Aceptada") .order("created_at", { ascending: false });` |
| `src/services/crm/actividades.ts:28` | `crm_actividades` | `.from("crm_actividades") .select(COLS, { count: "exact" }) .order("fecha_programada", { ascending: true, nullsFirst: false });` |
| `src/services/crm/cliente360.ts:51` | `crm_etapas_pipeline` | `.from("crm_etapas_pipeline").select("id, tipo"), ]);` |
| `src/services/crm/dashboard.ts:90` | `crm_etapas_pipeline` | `.from("crm_etapas_pipeline").select("id, nombre, color, tipo, orden").eq("activa", true).order("orden", { ascending: true }), ]);` |
| `src/services/crm/etapas.ts:15` | `crm_etapas_pipeline` | `.from("crm_etapas_pipeline") .select(COLS) .eq("activa", true) .order("orden", { ascending: true });` |
| `src/services/crm/etapas.ts:25` | `crm_etapas_pipeline` | `.from("crm_etapas_pipeline") .select(COLS) .order("orden", { ascending: true });` |
| `src/services/crm/etapas.ts:61` | `crm_motivos_perdida` | `.from("crm_motivos_perdida").select("id, nombre, activa").order("nombre");` |
| `src/services/crm/forecast.ts:18` | `crm_etapas_pipeline` | `.from("crm_etapas_pipeline") .select("id, tipo");` |
| `src/services/crm/forecast.ts:27` | `crm_oportunidades` | `.from("crm_oportunidades") .select("id, monto_estimado, probabilidad, fecha_estimada_cierre, vendedor_email, etapa_id");` |
| `src/services/crm/forecast.ts:38` | `crm_leads` | `.from("crm_leads").select("estado, fuente"), supabase.from("crm_oportunidades").select("motivo_perdida_id, etapa_id"), supabase.from("crm_mo` |
| `src/services/crm/forecast.ts:39` | `crm_oportunidades` | `.from("crm_oportunidades").select("motivo_perdida_id, etapa_id"), supabase.from("crm_motivos_perdida").select("id, nombre"), supabase.from("` |
| `src/services/crm/forecast.ts:40` | `crm_motivos_perdida` | `.from("crm_motivos_perdida").select("id, nombre"), supabase.from("crm_etapas_pipeline").select("id, nombre, tipo"), ]);` |
| `src/services/crm/forecast.ts:41` | `crm_etapas_pipeline` | `.from("crm_etapas_pipeline").select("id, nombre, tipo"), ]);` |
| `src/services/crm/leaderboard.ts:28` | `crm_cuotas_vendedor` | `.from("crm_cuotas_vendedor") .select("vendedor_email, cuota_monto, anio, mes") .eq("anio", anio) .eq("mes", mes), supabase .from("crm_oportu` |
| `src/services/crm/leaderboard.ts:33` | `crm_oportunidades` | `.from("crm_oportunidades") .select("vendedor_email, valor_real, monto_estimado, etapa_id, fecha_cierre_real") .gte("fecha_cierre_real", inic` |
| `src/services/crm/leaderboard.ts:36` | `crm_etapas_pipeline` | `.from("crm_etapas_pipeline").select("id, tipo"), ]);` |
| `src/services/crm/oportunidades.ts:24` | `crm_oportunidades` | `.from("crm_oportunidades") .select(COLS, { count: "exact" }) .order("created_at", { ascending: false });` |
| `src/services/crm/plantillas.ts:34` | `crm_plantillas_mensaje` | `.from("crm_plantillas_mensaje").select(COLS).order("nombre");` |
| `src/services/crm/leads/queries.ts:22` | `crm_leads` | `.from("crm_leads") .select(LEAD_COLUMNS, { count: "exact" }) .order("created_at", { ascending: false });` |
| `src/services/embarque/queries/extras.ts:8` | `embarques` | `.from("embarques") .select("id, expediente, bl_house, contenedor, tipo_contenedor, peso_kg, volumen_m3, piezas, estado") .eq("bl_master", bl` |
| `src/services/embarque/queries/proveedores.ts:8` | `proveedores` | `.from("proveedores").select("id, nombre").order("nombre");` |
| `src/services/facturas/huecoFacturacion/fetchSources.ts:24` | `embarques` | `.from("embarques") .select( "id, expediente, cliente_nombre, operador, etd, eta, bl_master, bl_house, tipo_cambio_usd, tipo_cambio_eur", ) .` |
| `src/services/facturas/huecoFacturacion/fetchSources.ts:39` | `conceptos_venta` | `.from("conceptos_venta").select("embarque_id, total, moneda").in("embarque_id", ids), expedientes.length > 0 ? supabase .from("facturas") .s` |
| `src/services/facturas/huecoFacturacion/fetchSources.ts:42` | `facturas` | `.from("facturas") .select("expediente, factura_pdf_url") .in("expediente", expedientes) .not("factura_pdf_url", "is", null) : Promise.resolv` |
| `src/services/facturas/index.ts:115` | `conceptos_costo` | `.from("conceptos_costo") .select("*, embarques!conceptos_costo_embarque_id_fkey(expediente)") .eq("estado_liquidacion", "Pendiente") .order(` |
| `src/services/facturas/proyeccion/fetchSources.ts:25` | `embarques` | `.from("embarques") .select( "id, expediente, cliente_nombre, operador, eta, contenedor, tipo_cambio_usd, tipo_cambio_eur, tiene_proforma", )` |
| `src/services/facturas/proyeccion/fetchSources.ts:40` | `conceptos_venta` | `.from("conceptos_venta").select("embarque_id, total, moneda").in("embarque_id", ids), supabase.from("conceptos_costo").select("embarque_id, ` |
| `src/services/facturas/proyeccion/fetchSources.ts:41` | `conceptos_costo` | `.from("conceptos_costo").select("embarque_id, monto, moneda").in("embarque_id", ids), expedientes.length > 0 ? supabase .from("facturas") .s` |
| `src/services/facturas/proyeccion/fetchSources.ts:44` | `facturas` | `.from("facturas") .select("expediente, factura_pdf_url") .in("expediente", expedientes) .not("factura_pdf_url", "is", null) : Promise.resolv` |
| `src/services/portal/queries.ts:20` | `embarques` | `.from("embarques") .select(PORTAL_EMBARQUE_LIST_COLUMNS) .in("cliente_id", clienteIds) .order("created_at", { ascending: false });` |
| `src/services/portal/queries.ts:71` | `cotizaciones` | `.from("cotizaciones") .select(PORTAL_COTIZACION_LIST_COLUMNS) .in("cliente_id", clienteIds) .in("estado", PORTAL_COTIZACION_ESTADOS_VISIBLES` |
| `src/services/portal/queries.ts:126` | `facturas` | `.from("facturas") .select(PORTAL_FACTURA_LIST_COLUMNS) .in("cliente_id", clienteIds) .order("fecha_emision", { ascending: false });` |
| `src/services/portal/queries.ts:135` | `client_users` | `.from("client_users").select("*");` |
| `src/services/proforma/facturar.ts:88` | `facturas` | `.from("facturas") .insert(facturasACrear) .select("id");` |
| `src/services/usuario/index.ts:29` | `organization_members` | `.from("organization_members") .select("user_id, role, created_at") .order("created_at", { ascending: false });` |

## CATALOG — detalle

- `src/services/admin/members.ts:38` — `organizations`
- `src/services/admin/organizations.ts:18` — `organizations`
- `src/services/admin/organizations.ts:27` — `organizations`
- `src/services/admin/stats.ts:29` — `organizations`
- `src/services/catalogos/index.ts:69` — `puertos`
- `src/services/configuracion/index.ts:21` — `configuracion`
- `src/services/configuracion/index.ts:33` — `configuracion`
- `src/services/organization/index.ts:18` — `organizations`
- `src/services/planes/index.ts:21` — `planes`

## OK — sólo conteo por archivo

- `src/services/portal/queries.ts` — 8
- `src/services/proforma/queries.ts` — 7
- `src/services/crm/dashboard.ts` — 6
- `src/services/admin/stats.ts` — 5
- `src/services/cliente/crud.ts` — 4
- `src/services/crm/lineage.ts` — 4
- `src/services/crm/leads/convertir.ts` — 4
- `src/services/cotizacion/conversiones/duplicar.ts` — 3
- `src/services/cotizacion/queries.ts` — 3
- `src/services/crm/actividades.ts` — 3
- `src/services/crm/cliente360.ts` — 3
- `src/services/crm/search.ts` — 3
- `src/services/embarque/documentos.ts` — 3
- `src/services/facturas/exports.ts` — 3
- `src/services/proveedor/index.ts` — 3
- `src/services/admin/observability.ts` — 2
- `src/services/auditoria/comentarios.ts` — 2
- `src/services/auditoria/revisiones.ts` — 2
- `src/services/cliente/contactos.ts` — 2
- `src/services/cliente/relacionados.ts` — 2
- `src/services/cotizacion/conversiones/embarques.ts` — 2
- `src/services/cotizacion/costos.ts` — 2
- `src/services/crm/automatizacionesEtapa.ts` — 2
- `src/services/crm/nbaSignals.ts` — 2
- `src/services/crm/notificaciones.ts` — 2
- `src/services/crm/oportunidades.ts` — 2
- `src/services/embarque/jsoncargo.ts` — 2
- `src/services/embarque/jsoncargoFechas.ts` — 2
- `src/services/embarque/queries/conceptos.ts` — 2
- `src/services/embarque/queries/detalle.ts` — 2
- `src/services/embarque/queries/exportListado.ts` — 2
- `src/services/facturas/snapshots.ts` — 2
- `src/services/proforma/crud.ts` — 2
- `src/services/admin/members.ts` — 1
- `src/services/admin/organizations.ts` — 1
- `src/services/auditoria/snooze.ts` — 1
- `src/services/auth/index.ts` — 1
- `src/services/bitacora/index.ts` — 1
- `src/services/cliente-usuarios/index.ts` — 1
- `src/services/cliente/financials.ts` — 1
- `src/services/cotizacion/conversiones/prospecto.ts` — 1
- `src/services/cotizacion/mutations/crear.ts` — 1
- `src/services/crm/comentarios.ts` — 1
- `src/services/crm/cotizacionDesdeOportunidad.ts` — 1
- `src/services/crm/cotizacionesSinRespuesta.ts` — 1
- `src/services/crm/oportunidadCotizaciones.ts` — 1
- `src/services/crm/proximasActividades.ts` — 1
- `src/services/crm/leads/queries.ts` — 1
- `src/services/crm/leads/mutations.ts` — 1
- `src/services/embarque/eventos.ts` — 1
- `src/services/embarque/queries/expedientes.ts` — 1
- `src/services/portal/notificaciones.ts` — 1
- `src/services/proforma/facturar.ts` — 1
- `src/services/tracking/index.ts` — 1
