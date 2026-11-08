-- Aplica en producción la limpieza de índices de supabase/migrations/
-- 20260819120100 (revisado 2026-11-08) sólo donde otro índice no parcial
-- cubre exactamente las mismas columnas. No se aplica FORCE RLS: los
-- procesos automáticos que corren como dueño de tabla podrían romperse.
DO $limpieza$
DECLARE
  v_nombre text;
  v_idx oid;
BEGIN
  FOREACH v_nombre IN ARRAY ARRAY[
    'idx_org_members_user_id','idx_client_users_user_id','idx_documentos_embarque_eid',
    'idx_documentos_embarque_embarque_id','idx_facturas_embarque_id','idx_facturas_cliente_id',
    'idx_notas_embarque_embarque_id','idx_contactos_cliente_cliente_id',
    'idx_cotizacion_costos_cotizacion_id','idx_proformas_embarque_id','idx_proformas_cliente_id',
    'idx_conceptos_venta_embarque_id','idx_conceptos_venta_proforma_id','idx_pcc_proforma_id',
    'idx_crm_oportunidades_etapa_id','idx_crm_oportunidades_cliente_id','idx_pfc_concepto_costo_id',
    'idx_gar_hist_garantia','idx_facturas_facturapi_id','idx_org_members_org_id'
  ] LOOP
    v_idx := to_regclass('public.' || v_nombre);
    CONTINUE WHEN v_idx IS NULL;
    IF EXISTS (
      SELECT 1
      FROM pg_index a
      JOIN pg_index b ON b.indrelid = a.indrelid
        AND b.indexrelid <> a.indexrelid
        AND b.indkey = a.indkey
        AND b.indpred IS NULL
        AND b.indexprs IS NULL
      WHERE a.indexrelid = v_idx
        AND a.indpred IS NULL
        AND a.indexprs IS NULL
        AND NOT a.indisunique
        AND NOT a.indisprimary
    ) THEN
      EXECUTE format('DROP INDEX IF EXISTS public.%I', v_nombre);
      RAISE NOTICE 'índice duplicado eliminado: %', v_nombre;
    END IF;
  END LOOP;
END
$limpieza$;