-- =============================================================
-- schema-invariants.sql · Bloque 2 · Item 2.2
--
-- Snapshot esperado de triggers en `public.*` y funciones críticas.
-- Se ejecuta en CI (staging) DESPUÉS de aplicar migraciones. Falla si:
--   1) Falta algún trigger listado (regresión: alguien lo dropeó sin recrear).
--   2) Falta alguna función crítica (guards, asserts, tg_*).
--
-- Cómo actualizarlo:
--   - Cualquier migración que DROP TRIGGER / DROP FUNCTION debe recrearlos en la
--     misma migración y actualizar este snapshot en el mismo PR.
--   - No se validan triggers/funciones "nuevos" (permite crecer sin fricción);
--     el objetivo es evitar borrados silenciosos de guards de negocio.
--
-- Uso manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/schema-invariants.sql
-- =============================================================

DO $$
DECLARE
  expected_triggers text[] := ARRAY[
    'anticipos_aplicaciones|trg_anticipo_saldo',
    'auditoria_revisiones|trg_auditoria_revisiones_updated_at',
    'auditoria_revisiones|trg_notificar_asignacion_hallazgo',
    'auditoria_revisiones|trg_set_revisado_at',
    'auditoria_revisiones|trg_touch_auditoria_revisiones',
    'auditoria_revisiones|trg_validar_snooze_auditoria',
    'bbva_movimientos|trg_movimiento_pago_consistente',
    'catalogo_claves_sat|trg_catalogo_claves_sat_updated_at',
    'clientes|trg_clientes_normaliza_campos',
    'clientes|trg_clientes_sync_cp',
    'clientes|update_clientes_updated_at',
    'cobranza_seguimiento|trg_cobranza_seg_updated_at',
    'comisiones_devengadas|trg_com_dev_updated',
    'conceptos_costo|trg_bloquear_cierre',
    'conceptos_costo|trg_bloquear_conceptos_costo_cerrado',
    'conceptos_factura|trg_conceptos_factura_calc_ret',
    'conceptos_factura|trg_conceptos_factura_rollup',
    'conceptos_venta|trg_bloquear_cierre',
    'conceptos_venta|trg_bloquear_conceptos_venta_cerrado',
    'conceptos_venta|trg_sync_embarque_tiene_proforma_from_concepto',
    'configuracion|update_configuracion_updated_at',
    'costeo_agentes|trg_costeo_agentes_updated',
    'costeo_demoras_venta_tarifa|trg_demoras_venta_updated_at',
    'costeo_naviera_demoras_tarifa|trg_costeo_demoras_updated',
    'costeo_navieras_condiciones|trg_costeo_nav_cond_updated',
    'costeo_rutas|trg_costeo_rutas_updated',
    'costeo_tarifas|costeo_tarifas_match_agente_org_trg',
    'costeo_tarifas|trg_costeo_tarifas_agente_force_borrador',
    'costeo_tarifas|trg_costeo_tarifas_marcar_reemplazadas',
    'costeo_tarifas|trg_costeo_tarifas_updated',
    'cotizacion_costos|update_cotizacion_costos_updated_at',
    'cotizacion_plantillas|trg_cotizacion_plantillas_updated_at',
    -- v13.823.57: los tres triggers competidores
    -- (trg_cotizacion_acepta_oportunidad, trg_cotizacion_cierra_oportunidad,
    -- trg_crm_set_valor_real_on_aceptada) fueron retirados y reemplazados por
    -- zz_crm_cerrar_oportunidad_desde_cotizacion. Ver bloques 3 y 4.
    'cotizaciones|zz_crm_cerrar_oportunidad_desde_cotizacion',

    'cotizaciones|trg_guard_estado_cotizacion',
    'cotizaciones|trg_snapshot_cotizacion_al_enviar',
    'cotizaciones|trg_validate_cotizacion_informativa',
    'cotizaciones|update_cotizaciones_updated_at',
    'crm_actividades|trg_crm_act_updated_at',
    'crm_comentarios_oportunidad|trg_crm_notify_comentario_oportunidad',
    'crm_cuotas_vendedor|trg_crm_cuotas_updated_at',
    'crm_etapas_pipeline|trg_crm_etapas_updated_at',
    'crm_leads|trg_crm_leads_updated_at',
    'crm_oportunidades|trg_crm_op_updated_at',
    'cuentas_bancarias|trg_cuentas_bancarias_updated',
    'documentos_embarque|trg_bloquear_cierre',
    'embarque_contenedores|trg_bloquear_cierre',
    'embarque_contenedores|trg_contenedor_demoras_recalc',
    'embarque_contenedores|trg_crear_garantia_contenedor',
    'embarque_contenedores|trg_embarque_contenedores_updated_at',
    'embarque_contenedores|trg_sync_embarque_desde_contenedor',
    'embarque_garantias_contenedor|trg_calc_fecha_limite_devolucion',
    'embarque_garantias_contenedor|trg_garantia_auto_materializar',
    'embarque_garantias_contenedor|trg_garantia_congelar_monto',
    'embarque_garantias_contenedor|trg_garantia_fechas_requeridas',
    'embarque_garantias_contenedor|trg_garantia_historial',
    'embarque_garantias_contenedor|trg_garantia_transicion_valida',
    'embarque_garantias_contenedor|trg_garantias_updated_at',
    'embarques|embarques_set_fechas_originales',
    'embarques|trg_bloquear_embarque_self',
    'embarques|trg_embarque_transicion_valida',
    'embarques|trg_embarques_entregado_demoras',
    'embarques|trg_embarques_freeze_eta_original',
    'embarques|trg_embarques_protect_creator',
    'embarques|trg_enforce_cotizacion_obligatoria',
    'embarques|trg_notif_cli_embarque_estado',
    'embarques|trg_set_embarque_created_by',
    'embarques|trg_sync_cotizacion_embarque_link',
    'embarques|update_embarques_updated_at',
    'eventos_embarque|trg_bloquear_cierre',
    'factura_notas_credito|trg_nc_no_delete',
    'factura_notas_credito|trg_nc_no_excede_saldo',
    'factura_notas_credito|trg_recalcular_estado_factura_nc',
    'factura_notas_credito|update_factura_notas_credito_updated_at',
    'factura_series|update_factura_series_updated_at',
    'facturapi_credenciales|trg_facturapi_credenciales_updated_at',
    'facturas|trg_bloquear_factura_emitida',
    'facturas|trg_congelar_factura',
    'facturas|trg_factura_cancelada_comisiones',
    'facturas|trg_factura_tc_extranjera_obligatorio',
    'facturas|trg_facturas_estado_a_embarques',
    'facturas|trg_facturas_link_proforma',
    'facturas|trg_facturas_set_fecha_vencimiento',
    'facturas|trg_guard_estado_factura',
    'facturas|trg_guard_sustitucion_ciclo',
    'facturas|update_facturas_updated_at',
    'liquidaciones_comision|trg_liq_com_updated',
    'organizations|trg_handle_new_organization',
    'pagos_factura|trg_pago_factura_comision_ins',
    'pagos_factura|trg_pago_factura_rep_viva',
    'pagos_factura|trg_pago_no_altera_historia_rep',
    'pagos_factura|trg_pago_sin_rep_vivo',
    'pagos_factura|trg_pago_sin_rep_vivo_delete',
    'pagos_factura|trg_pagos_factura_autocierre',
    'pagos_factura|trg_pagos_factura_monto_convertido',
    'pagos_factura|trg_recalcular_estado_factura',
    'pagos_factura|trg_set_estado_rep_pago',
    'pagos_factura|trg_sync_pago_factura_embarque',
    'pagos_factura|update_pagos_factura_updated_at',
    -- Renombrados con prefijo zz*/zzz* para garantizar orden de ejecución
    -- (la conversión de moneda debe correr antes de las validaciones).
    'pagos_factura|zz_pago_factura_viva',
    'pagos_factura|zz_pagos_factura_no_sobrepago',
    'pagos_factura|zzz_pagos_factura_calc_ret',

    'pagos_proveedor|pagos_proveedor_requiere_aprobacion',
    'pagos_proveedor|trg_pago_proveedor_factura_viva',
    'pagos_proveedor|trg_pagos_proveedor_guard',
    'pagos_proveedor|trg_pagos_proveedor_recalc_liq',
    'pagos_proveedor|trg_pagos_proveedor_recalcular_estado',
    'pagos_proveedor|trg_pagos_proveedor_updated',
    'presupuesto_categorias|trg_presupuesto_categorias_updated_at',
    'presupuesto_mensual|trg_presupuesto_mensual_updated_at',
    'proformas|set_proformas_updated_at',
    'proformas|trg_congelar_proforma',
    'proformas|trg_enforce_proforma_aceptada',
    'proformas|trg_proforma_eur_no_soportada',
    'proformas|trg_proforma_no_soft_delete_facturada',
    'proformas|trg_sync_conceptos_venta_facturado',
    'proformas|trg_sync_embarque_tiene_proforma',
    'proveedor_facturas|trg_guard_estado_proveedor_factura',
    'proveedor_facturas|trg_liberar_folio_proveedor_factura',
    'proveedor_facturas|trg_proveedor_facturas_recalc_liq',
    'proveedor_facturas|trg_proveedor_facturas_updated',
    'proveedor_facturas|trg_reverse_ajustes_factura_proveedor',
    'proveedor_facturas|trg_set_folio_interno_proveedor_factura',
    'proveedor_facturas_conceptos|trg_pfc_recalc_liq',
    'proveedor_notas_credito|trg_nc_prov_estado_machine',
    'proveedor_notas_credito|trg_notas_credito_prov_recalcular_estado',
    'proveedor_notas_credito|trg_proveedor_notas_credito_updated',
    'proveedores|update_proveedores_updated_at',
    'seguros_embarque|trg_bloquear_cierre',
    'seguros_embarque|trg_seguros_embarque_updated_at',
    'tracking_externo|trg_tracking_externo_updated',
    'vendedora_config|trg_vendedora_config_updated'
  ];
  expected_functions text[] := ARRAY[
    'assert_factura_viva_para_pago',
    'assert_factura_viva_para_rep',
    'assert_movimiento_pago_consistente',
    'assert_nc_no_excede_saldo',
    'assert_pago_no_altera_historia_rep',
    'assert_pago_sin_rep_vivo',
    -- Helpers extraídos en los splits de god functions (Sprint R2/R3) —
    -- protección anti-borrado: si una migración los dropea, el padre truena.
    '_audit_embarques_agregar',
    '_audit_embarques_umbrales',
    '_calcular_demoras_montos_contenedor',
    '_convertir_proformas_insertar_conceptos',
    '_crear_embarque_replicar_conceptos',
    'auditoria_embarques_org',
    'assert_pago_sin_rep_vivo_delete',
    'assert_proformas_moneda_soportada',
    'assert_proveedor_factura_viva_para_pago',
    'assert_transicion_embarque',
    'guard_estado_cotizacion',
    'guard_estado_factura',
    'guard_estado_proveedor_factura',
    'guard_sustitucion_ciclo',
    'has_role',
    'tg_anticipo_saldo',
    'tg_bloquear_embarque_cerrado_self',
    'tg_bloquear_si_embarque_cerrado',
    'tg_factura_cancelada_comisiones',
    'tg_facturas_link_proforma',
    'tg_liberar_folio_proveedor_factura',
    'tg_pago_factura_no_sobrepago',
    'tg_pagos_factura_monto_convertido',
    'guard_pago_proveedor',
    'tg_pagos_proveedor_recalc_liq',
    'tg_pagos_proveedor_requiere_aprobacion',
    'tg_pfc_recalc_liq',
    'tg_proforma_eur_no_soportada',
    'tg_proveedor_facturas_recalc_liq',
    'tg_recalcular_estado_factura_proveedor',
    'tg_reverse_ajustes_factura_proveedor',
    'trg_clientes_normaliza_campos',
    'trg_conceptos_factura_rollup',
    'trg_factura_tc_extranjera_obligatorio',
    'trg_facturas_estado_a_embarques',
    'trg_fn_embarque_transicion_valida',
    'trg_pago_factura_comision',
    'trg_recalcular_demoras_al_entregar',
    'trg_recalcular_demoras_contenedor',
    'validar_cierre_embarque',
    'validar_snooze_auditoria'
  ];
  missing text[];
BEGIN
  -- 1) Triggers faltantes
  SELECT array_agg(k)
    INTO missing
  FROM unnest(expected_triggers) k
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND n.nspname = 'public'
      AND (c.relname || '|' || t.tgname) = k
  );
  IF missing IS NOT NULL AND array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION E'schema-invariants: triggers faltantes: %', missing;
  END IF;

  -- 2) Funciones críticas faltantes
  SELECT array_agg(k)
    INTO missing
  FROM unnest(expected_functions) k
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = k
  );
  IF missing IS NOT NULL AND array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION E'schema-invariants: funciones faltantes: %', missing;
  END IF;

  RAISE NOTICE 'schema-invariants OK — % triggers + % funciones verificados',
    array_length(expected_triggers, 1),
    array_length(expected_functions, 1);
END $$;
