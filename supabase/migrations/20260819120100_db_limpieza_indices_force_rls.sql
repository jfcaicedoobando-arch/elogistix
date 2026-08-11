-- ============================================================================
-- P4: Limpieza de base de datos
-- ----------------------------------------------------------------------------
--  a) DROP de índices duplicados reales (misma tabla/columnas/predicado,
--     distinto nombre). Verificado por replay de las 862 migraciones: ambos
--     índices de cada par se crean y ninguno se dropea después. Se conserva
--     el índice más antiguo (o el UNIQUE, cuando aplica).
--  b) FORCE ROW LEVEL SECURITY en las tablas de dinero.
--  c) DO de verificación: tras los DROP, debe seguir existiendo AL MENOS un
--     índice que cubra cada columna afectada; si no, RAISE EXCEPTION.
--
-- Pares EXCLUIDOS tras verificación (NO son duplicados reales):
--   * idx_conceptos_venta_embarque_activo: índice PARCIAL (WHERE deleted_at
--     IS NULL) sobre conceptos_venta(embarque_id), distinto del índice plano.
--   * idx_factura_embarques_embarque_activa: índice PARCIAL (WHERE activa)
--     sobre factura_embarques(embarque_id), distinto del índice plano.
--   * anticipos_cliente: la tabla NO existe en el repo (solo
--     anticipos_proveedor y anticipos_aplicaciones); se omite del FORCE RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- a) Índices duplicados
-- ----------------------------------------------------------------------------

-- organization_members(user_id): idx_org_members_user (2026-04-18) conservado;
-- duplicado creado por la migración 20260516191240.
DROP INDEX IF EXISTS public.idx_org_members_user_id;

-- client_users(user_id): idx_client_users_user conservado.
DROP INDEX IF EXISTS public.idx_client_users_user_id;

-- documentos_embarque(embarque_id): TRES índices idénticos. Se conserva el más
-- antiguo, idx_documentos_embarque_embarque (2026-02-28); se dropean
-- idx_documentos_embarque_eid (2026-04-18) y el sufijo _id (2026-05-16).
DROP INDEX IF EXISTS public.idx_documentos_embarque_eid;
DROP INDEX IF EXISTS public.idx_documentos_embarque_embarque_id;

-- facturas(embarque_id): idx_facturas_embarque conservado.
DROP INDEX IF EXISTS public.idx_facturas_embarque_id;

-- facturas(cliente_id): idx_facturas_cliente conservado.
DROP INDEX IF EXISTS public.idx_facturas_cliente_id;

-- notas_embarque(embarque_id): idx_notas_embarque_embarque conservado.
DROP INDEX IF EXISTS public.idx_notas_embarque_embarque_id;

-- contactos_cliente(cliente_id): idx_contactos_cliente conservado.
DROP INDEX IF EXISTS public.idx_contactos_cliente_cliente_id;

-- cotizacion_costos(cotizacion_id): idx_cotizacion_costos_cotizacion conservado.
DROP INDEX IF EXISTS public.idx_cotizacion_costos_cotizacion_id;

-- proformas(embarque_id): idx_proformas_embarque conservado.
DROP INDEX IF EXISTS public.idx_proformas_embarque_id;

-- proformas(cliente_id): idx_proformas_cliente conservado.
DROP INDEX IF EXISTS public.idx_proformas_cliente_id;

-- conceptos_venta(embarque_id): idx_conceptos_venta_embarque conservado
-- (el parcial idx_conceptos_venta_embarque_activo NO se toca: no es duplicado).
DROP INDEX IF EXISTS public.idx_conceptos_venta_embarque_id;

-- conceptos_venta(proforma_id): idx_conceptos_venta_proforma conservado.
DROP INDEX IF EXISTS public.idx_conceptos_venta_proforma_id;

-- proforma_conceptos_consolidados(proforma_id): idx_pcc_proforma conservado.
DROP INDEX IF EXISTS public.idx_pcc_proforma_id;

-- crm_oportunidades(etapa_id): idx_crm_op_etapa conservado.
DROP INDEX IF EXISTS public.idx_crm_oportunidades_etapa_id;

-- crm_oportunidades(cliente_id): idx_crm_op_cliente conservado.
DROP INDEX IF EXISTS public.idx_crm_oportunidades_cliente_id;

-- proveedor_facturas_conceptos(concepto_costo_id): idx_pfc_concepto conservado.
DROP INDEX IF EXISTS public.idx_pfc_concepto_costo_id;

-- embarque_garantias_historial(garantia_id): se conserva el MÁS ANTIGUO,
-- idx_garantia_hist_garantia (2026-07-19); idx_gar_hist_garantia es de
-- 2026-07-30 y es el duplicado real.
DROP INDEX IF EXISTS public.idx_gar_hist_garantia;

-- facturas(facturapi_id) WHERE facturapi_id IS NOT NULL: existe un índice
-- parcial NO único (idx_facturas_facturapi_id, 2026-06-17) y un índice UNIQUE
-- idéntico (uq_facturas_facturapi_id, 2026-07-20). Se conserva el UNIQUE.
DROP INDEX IF EXISTS public.idx_facturas_facturapi_id;

-- organization_members(organization_id): idx_org_members_org_id es redundante
-- con el constraint UNIQUE(organization_id, user_id) de la tabla
-- (organization_id es la columna de prefijo del índice único, así que cubre
-- los lookups por organization_id solo). La cobertura la da el índice único.
DROP INDEX IF EXISTS public.idx_org_members_org_id;

-- ----------------------------------------------------------------------------
-- b) FORCE ROW LEVEL SECURITY en tablas de dinero
-- ----------------------------------------------------------------------------
-- ADVERTENCIA previa a promover en el entorno: FORCE RLS no afecta a
-- superuser ni a roles con BYPASSRLS, pero el OWNER de la tabla (típicamente
-- postgres) SÍ queda sujeto a las políticas. Verificar en el entorno destino
-- que service_role y el rol owner tienen las políticas/grants necesarios
-- antes de aplicar en producción.

ALTER TABLE public.facturas              FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_factura         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_proveedor       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.traspasos_bancarios   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.anticipos_proveedor   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.anticipos_aplicaciones FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_bancarias     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bbva_movimientos      FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- c) Verificación: cada columna que perdió un índice duplicado debe seguir
--    cubierta por AL MENOS un índice (plano, parcial o único) en esa tabla.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text[];
  v_pair    record;
BEGIN
  FOR v_pair IN
    SELECT * FROM (VALUES
      ('organization_members',            'user_id'),
      ('client_users',                    'user_id'),
      ('documentos_embarque',             'embarque_id'),
      ('facturas',                        'embarque_id'),
      ('facturas',                        'cliente_id'),
      ('facturas',                        'facturapi_id'),
      ('notas_embarque',                  'embarque_id'),
      ('contactos_cliente',               'cliente_id'),
      ('cotizacion_costos',               'cotizacion_id'),
      ('proformas',                       'embarque_id'),
      ('proformas',                       'cliente_id'),
      ('conceptos_venta',                 'embarque_id'),
      ('conceptos_venta',                 'proforma_id'),
      ('proforma_conceptos_consolidados', 'proforma_id'),
      ('crm_oportunidades',               'etapa_id'),
      ('crm_oportunidades',               'cliente_id'),
      ('proveedor_facturas_conceptos',    'concepto_costo_id'),
      ('embarque_garantias_historial',    'garantia_id'),
      ('organization_members',            'organization_id')
    ) AS t(tablename, colname)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename  = v_pair.tablename
        AND indexdef ILIKE '%(' || v_pair.colname || ',%'
        -- índice cuya PRIMERA columna es la buscada
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename  = v_pair.tablename
        AND indexdef ILIKE '%(' || v_pair.colname || ')%'
    ) THEN
      v_missing := array_append(v_missing, v_pair.tablename || '(' || v_pair.colname || ')');
    END IF;
  END LOOP;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'P4: columnas sin cobertura de índice tras los DROP: %', v_missing;
  END IF;

  RAISE NOTICE 'P4: verificación OK, todas las columnas afectadas conservan cobertura de índice';
END $$;

-- ----------------------------------------------------------------------------
-- d) NOTA (sin cambios en este archivo): el test supabase/tests/rls/
--    test_rls_anon_deny_all.sql NO cubre las siguientes tablas (todas existen
--    y tienen RLS en el schema actual). La edición del test se hará aparte:
--      traspasos_bancarios
--      pagos_factura_lote
--      pagos_proveedor_lote
--      embarque_facturas_entrantes
--      embarque_facturas_entrantes_conceptos
--      embarque_garantias_historial
--      tipos_cambio_dof
--      proveedor_alias
--      role_change_log
--      super_admin_org_activa
--      nav_events
--      provisioning_log
--    (El brief mencionaba 11 tablas; la lista verificada contiene 12 y las
--    12 existen realmente y faltan en el test.)
-- ----------------------------------------------------------------------------
