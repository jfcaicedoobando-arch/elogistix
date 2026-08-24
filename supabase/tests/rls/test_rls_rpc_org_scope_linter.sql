-- ============================================================================
-- Suite RLS — Linter de ancla tenant en RPCs SECURITY DEFINER (Ola 8, H3/M-13)
-- ============================================================================
-- Regla: TODA función `public` SECURITY DEFINER ejecutable por `authenticated`
-- debe referenciar en su cuerpo al menos un ANCLA de tenant:
--   organization_id · organization_members · current_user_org_id ·
--   default_user_org_id · has_role_in_org · has_any_role_in_org(_exact) ·
--   current_agente_org · current_agente_id · current_user_client_ids ·
--   client_users · agente_users
-- (mismo criterio de anclas que test_rls_policy_linter.sql, más los helpers
-- de identidad por org/agente que envuelven esas tablas).
--
-- Motivo: la clase de bugs cross-tenant de la Ola 1 (RPC que chequea rol
-- global en user_roles y opera sobre IDs de otra org). Las RPCs nuevas deben
-- autorizar por membresía en la org del documento (Ola 8).
--
-- Recortes deliberados del análisis estático:
--   · Se excluyen funciones que devuelven `trigger`: no son invocables por
--     PostgREST/RPC (sólo como trigger), auditarlas aquí sería ruido.
--   · La comparación es textual sobre prosrc: una función que menciona
--     organization_id pero lo usa mal NO pasa el linter (no es su objetivo);
--     una función pura que no toca tablas tenant queda en la whitelist.
--
-- WHITELIST CONGELADA (inventario real 2026-08-27, hecho por replay de
-- migraciones sobre base limpia + verificación contra la BD local):
--   53 funciones. El review estimó ~38 contando sólo las que leen
--   `user_roles` directamente; el patrón textual también captura helpers
--   puros (conversión de moneda, colas de email) y funciones-por-ID cuya
--   tenancy la garantiza el caller vía RLS — deuda real pero distinta.
--   Delta documentado: 53 = 11 helpers de rol/plataforma + 3 portal/token +
--   13 colas/jobs + 8 cálculo puro + 18 funciones-por-ID (deuda por-ID).
--
-- Cómo mantenerla:
--   · RPC NUEVA sin ancla → el linter falla: añade el ancla, NO la whitelist.
--   · Función whitelisteada que gana ancla o deja de existir → el linter
--     falla con "entrada muerta": bórrala de la lista (deuda saldada).
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_rpc_org_scope_linter.sql
-- ============================================================================

BEGIN;

DO $$
DECLARE
  flagged text[];
  fuera text[];
  muertas text[];
  whitelist text[] := ARRAY[
    -- ── A. Helpers de rol/plataforma: el rol de plataforma vive en
    --    user_roles por diseño (super_admin está PROHIBIDO en
    --    organization_members); son los helpers que las demás RPCs llaman.
    'has_role',
    'has_any_role',
    'es_escritor_financiero',
    'es_admin_catalogo',
    'is_finance',
    'is_operations',
    'is_sales',
    'can_admin_tenant',
    'can_view_financials',
    'puede_escribir_cotizaciones',
    'rls_tenant_scope_ok',
    -- ── B. Portal/token público: identidad por token firmado, no por org
    --    (mismo criterio que la whitelist anon de FIX-45).
    'portal_obtener_proforma_por_token',
    'log_client_error_v1',
    'check_ratelimit',
    -- ── C. Colas y jobs internos (cron/edge/service): operan tablas de
    --    infraestructura global (email, logs, webhooks), no documentos tenant.
    'enqueue_email',
    'read_email_batch',
    'delete_email',
    'move_to_dlq',
    'email_queue_dispatch',
    'detectar_alertas_app_logs',
    'purge_app_logs_old',
    'purgar_facturapi_webhook_eventos',
    'expirar_cotizaciones_job',
    'marcar_facturas_vencidas',
    'crm_backfill_cotizaciones_sin_oportunidad',
    'seed_demo_organization',
    'seed_demo_organization_guarded',
    -- ── D. Cálculo puro / conversión / estado derivado: reciben IDs o
    --    importes, no leen tablas tenant directamente o son helpers de
    --    aritmética de moneda. idempotency_store es por (key, user_id),
    --    patrón personal ya exento en el linter de policies.
    'a_mxn_doc',
    'tc_dof_vigente',
    'tc_para_documento',
    'calcular_costo_demoras',
    'saldo_cuenta_bancaria',
    'idempotency_store',
    -- ── E. Deuda real por-ID: reciben el ID de un documento que el caller
    --    obtuvo vía RLS y operan sobre él sin re-validar la org. Es la clase
    --    que este linter congela; migrar a ancla tenant explícita una por una.
    '_assert_receptor_fiscal_valido',
    '_cxp_desvincular_por_rechazo',
    '_recalc_anticipo_saldo',
    '_recalc_estado_proveedor_factura',
    '_refact_reps_bloqueantes',
    'assert_transicion_embarque',
    'cliente_requiere_autorizacion',
    'comision_embarques_de_factura',
    'convertir_proformas_a_factura_check_embarque_vivo',
    'embarque_admin_pendientes_resumen',
    'embarque_operativo_completo',
    'enforce_revalidacion_sin_cambios',
    'liberar_conceptos_de_proforma',
    'recalcular_cobro_embarques',
    'recalcular_estado_liquidacion_concepto',
    'recalcular_estado_liquidacion_factura',
    'recompute_embarque_tiene_proforma',
    'resolver_sin_comision'
  ];
BEGIN
  -- Funciones SECURITY DEFINER ejecutables por authenticated SIN ancla tenant.
  SELECT array_agg(p.proname ORDER BY p.proname)
    INTO flagged
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef = true
     AND p.prokind = 'f'
     AND p.prorettype <> 'pg_catalog.trigger'::regtype
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
     AND p.prosrc !~* '(organization_id|organization_members|current_user_org_id|default_user_org_id|has_role_in_org|has_any_role_in_org|current_agente_org|current_agente_id|current_user_client_ids|client_users|agente_users)';

  -- 1) Nuevas sin ancla y fuera de la whitelist → FAIL.
  SELECT array_agg(f ORDER BY f)
    INTO fuera
    FROM unnest(COALESCE(flagged, '{}'::text[])) AS f
   WHERE f <> ALL (whitelist);

  IF fuera IS NOT NULL AND array_length(fuera, 1) > 0 THEN
    RAISE EXCEPTION E'RPC ORG-SCOPE LINTER FAIL: función(es) SECURITY DEFINER ejecutables por authenticated SIN ancla tenant y fuera de la whitelist congelada:\n  %\nAñade una referencia de tenant (organization_id / has_any_role_in_org / current_user_org_id…) a la RPC; no amplíes la whitelist sin documentar la excepción.', fuera;
  END IF;

  -- 2) Entradas muertas: whitelisteada y ya con ancla, o inexistente → FAIL
  --    (deuda saldada o drift de inventario; quitar la entrada).
  SELECT array_agg(w ORDER BY w)
    INTO muertas
    FROM unnest(whitelist) AS w
   WHERE w <> ALL (COALESCE(flagged, '{}'::text[]));

  IF muertas IS NOT NULL AND array_length(muertas, 1) > 0 THEN
    RAISE EXCEPTION E'RPC ORG-SCOPE LINTER FAIL: entrada(s) muertas en la whitelist (ya tienen ancla tenant o ya no existen):\n  %\nQuítalas de la lista — la deuda congelada sólo puede BAJAR.', muertas;
  END IF;

  RAISE NOTICE '✓ test_rls_rpc_org_scope_linter: 0 hallazgos; whitelist congelada en % funciones (inventario 2026-08-27)', array_length(whitelist, 1);
END;
$$;

ROLLBACK;
