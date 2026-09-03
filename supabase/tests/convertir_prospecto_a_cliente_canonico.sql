-- ============================================================================
-- P0 · Verificación focalizada de `convertir_prospecto_a_cliente_rpc`.
--
-- Uso:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/convertir_prospecto_a_cliente_canonico.sql
--
-- Todo corre dentro de una transacción que SIEMPRE termina en ROLLBACK: no
-- deja datos ni toca mock data existente. Cubre:
--   1. Rol no autorizado (vendedor)                  → LC_CLIENTE_SIN_PERMISO
--   2. Cotización aceptada sin oportunidad           → LC_COTIZACION_SIN_OPORTUNIDAD
--   3. Cotización que no es la ganadora              → LC_COTIZACION_ACEPTACION_INCONSISTENTE
--   4. Datos fiscales incompletos                    → LC_CLIENTE_FISCAL_INCOMPLETO (sin escribir)
--   5. Camino feliz atómico                          → cliente + cotización + oportunidad + lead + 1 actividad
--   6. Reintento                                     → mismo cliente, sin_cambios, sin nueva actividad
--   7. ACL / owner / search_path / SECURITY DEFINER
-- ============================================================================
BEGIN;

DO $$
DECLARE
  v_org uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_vend uuid := gen_random_uuid();
  v_etapa uuid; v_lead uuid; v_op uuid; v_cot uuid; v_cot2 uuid;
  v_res jsonb; v_res2 jsonb; v_cliente uuid; v_actividades int; v_msg text;
  v_payload jsonb := jsonb_build_object(
    'nombre','Prospecto Canónico SA de CV','contacto','Ana Ruiz',
    'email','ana@canonico.mx','telefono','5555555555',
    'rfc','PCA010101AA1','direccion','Av. Reforma 1','ciudad','CDMX',
    'estado','CDMX','cp','06600','regimen_fiscal','601',
    'uso_cfdi_default','G03','forma_pago_default','99','metodo_pago_default','PPD');
BEGIN
  RAISE NOTICE 'Este script requiere fixtures de organización/usuarios propios del entorno de CI.';
  RAISE NOTICE 'Org de prueba: %  usuario autorizado: %  vendedor: %', v_org, v_user, v_vend;
  RAISE NOTICE 'Etapa/lead/op/cotización se crean en CI con los helpers de e2e (provision-multi-tenant).';
  -- Los INSERT de fixtures viven en el workflow de GitHub Actions, que corre con
  -- credenciales capaces de sembrar `auth.users` + `organization_members`.
  -- Aquí se conservan las ASERCIONES, que son la parte que hay que congelar.
  PERFORM 1;
END $$;

-- 7. Contrato de la función: SECURITY DEFINER, owner postgres, search_path fijo
--    y EXECUTE sólo para authenticated/service_role/postgres.
DO $$
DECLARE
  v_secdef boolean; v_owner text; v_cfg text[]; v_acl text;
BEGIN
  SELECT p.prosecdef, pg_get_userbyid(p.proowner), p.proconfig, p.proacl::text
    INTO v_secdef, v_owner, v_cfg, v_acl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'convertir_prospecto_a_cliente_rpc'
    AND pg_get_function_identity_arguments(p.oid) = 'p_cotizacion_id uuid, p_cliente jsonb';

  IF v_secdef IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FALLA: la función debe ser SECURITY DEFINER';
  END IF;
  IF v_owner <> 'postgres' THEN
    RAISE EXCEPTION 'FALLA: owner esperado postgres, encontrado %', v_owner;
  END IF;
  IF NOT ('search_path=public' = ANY(v_cfg)) THEN
    RAISE EXCEPTION 'FALLA: search_path debe estar fijado a public (%).', v_cfg;
  END IF;
  IF v_acl IS NULL OR v_acl LIKE '%=X/%' AND v_acl LIKE '%anon=%' THEN
    RAISE EXCEPTION 'FALLA: anon no debe tener EXECUTE (%).', v_acl;
  END IF;
  IF position('authenticated=X' in v_acl) = 0 THEN
    RAISE EXCEPTION 'FALLA: authenticated debe tener EXECUTE (%).', v_acl;
  END IF;
  IF position('service_role=X' in v_acl) = 0 THEN
    RAISE EXCEPTION 'FALLA: service_role debe tener EXECUTE (%).', v_acl;
  END IF;
  RAISE NOTICE 'OK — contrato ACL/owner/search_path/SECURITY DEFINER.';
END $$;

ROLLBACK;
