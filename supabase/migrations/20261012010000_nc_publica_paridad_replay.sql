-- Forward candidate: source/catalog preconditions must pass before financial DDL.
-- Requires the caller transaction and ON_ERROR_STOP used by the official runner.
-- Unknown owner, ACL, security/search_path or source fails; no silent repair of access.
-- Postconditions preserve exact pg_proc metadata; internal authority stays untouched.

DO $nc_parity_pre$
DECLARE
  v_owner oid := pg_catalog.to_regrole('postgres')::oid;
  v_service oid := pg_catalog.to_regrole('service_role')::oid;
  v_anon oid := pg_catalog.to_regrole('anon')::oid;
  v_authenticated oid := pg_catalog.to_regrole('authenticated')::oid;
  v_signature text;
  v_proc pg_catalog.pg_proc%ROWTYPE;
  v_before jsonb;
BEGIN
  IF v_owner IS NULL OR v_service IS NULL OR v_anon IS NULL
     OR v_authenticated IS NULL THEN
    RAISE EXCEPTION 'NC_PARITY_ROLES: reviewed database roles must already exist';
  END IF;
  IF current_user <> 'postgres' OR session_user <> current_user THEN
    RAISE EXCEPTION 'NC_PARITY_EXECUTOR: execute as the existing postgres owner/grantor';
  END IF;

  FOREACH v_signature IN ARRAY ARRAY[
    'public.nc_aplicadas_en_moneda_factura(uuid)',
    'public._saldo_factura_calc(uuid)'
  ] LOOP
    SELECT p.* INTO v_proc FROM pg_catalog.pg_proc p
    WHERE p.oid = pg_catalog.to_regprocedure(v_signature);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NC_PARITY_MISSING: target % must already exist', v_signature;
    END IF;
    IF v_proc.proowner IS DISTINCT FROM v_owner
       OR v_proc.prokind IS DISTINCT FROM 'f'
       OR v_proc.provolatile IS DISTINCT FROM 's'
       OR v_proc.prosecdef IS DISTINCT FROM true
       OR v_proc.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
       OR v_proc.prorettype IS DISTINCT FROM 'numeric'::regtype::oid
       OR v_proc.proretset IS DISTINCT FROM false
       OR v_proc.pronargs IS DISTINCT FROM 1
       OR v_proc.proargnames IS DISTINCT FROM ARRAY['p_factura_id']::text[]
       OR v_proc.prosqlbody IS NOT NULL THEN
      RAISE EXCEPTION 'NC_PARITY_METADATA: unexpected identity, owner, signature, STABLE/DEFINER or search_path for %', v_signature;
    END IF;
    IF (v_signature = 'public._saldo_factura_calc(uuid)'
        AND v_proc.prolang IS DISTINCT FROM
          (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql'))
       OR (v_signature = 'public.nc_aplicadas_en_moneda_factura(uuid)'
           AND v_proc.prolang NOT IN
             (SELECT oid FROM pg_catalog.pg_language WHERE lanname IN ('sql','plpgsql'))) THEN
      RAISE EXCEPTION 'NC_PARITY_LANGUAGE: unexpected reviewed language for %', v_signature;
    END IF;

    -- Semantic canonical ACL equality, independent of entry order. Exactly
    -- one owner entry and one service entry, both from the existing owner,
    -- EXECUTE only, without grant options. A NULL/default ACL is rejected.
    IF v_proc.proacl IS NULL OR (
      SELECT count(*) = 2
        AND count(*) FILTER (WHERE a.grantee = v_owner) = 1
        AND count(*) FILTER (WHERE a.grantee = v_service) = 1
        AND bool_and(a.grantor = v_owner
                     AND a.privilege_type = 'EXECUTE'
                     AND NOT a.is_grantable)
      FROM pg_catalog.aclexplode(v_proc.proacl) a
    ) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'NC_PARITY_ACL: explicit owner/service_role ACL with reviewed grantor and flags required for %', v_signature;
    END IF;
    IF pg_catalog.has_function_privilege(v_anon, v_proc.oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege(v_authenticated, v_proc.oid, 'EXECUTE')
       OR NOT pg_catalog.has_function_privilege(v_service, v_proc.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'NC_PARITY_EFFECTIVE_ACL: unexpected effective client/service access for %', v_signature;
    END IF;
  END LOOP;

  IF pg_catalog.to_regprocedure('public._nc_aplicadas_moneda_factura(uuid)') IS NULL THEN
    RAISE EXCEPTION 'NC_PARITY_INTERNAL_MISSING: existing authority is required';
  END IF;

  -- pg_proc includes OID, owner, exact ACL array/order, configuration, security,
  -- volatility and all other function attributes. Exclude only intentional
  -- replacements: wrapper source/language, and balance source. The internal
  -- authority is saved COMPLETE: its replay/installed metadata can differ.
  SELECT pg_catalog.jsonb_object_agg(t.signature,
    CASE t.kind
      WHEN 'wrapper' THEN pg_catalog.to_jsonb(p) - ARRAY['prosrc','prolang']::text[]
      WHEN 'balance' THEN pg_catalog.to_jsonb(p) - 'prosrc'
      ELSE pg_catalog.to_jsonb(p)
    END)
  INTO v_before
  FROM (VALUES
    ('public.nc_aplicadas_en_moneda_factura(uuid)', 'wrapper'),
    ('public._saldo_factura_calc(uuid)', 'balance'),
    ('public._nc_aplicadas_moneda_factura(uuid)', 'internal')
  ) t(signature, kind)
  JOIN pg_catalog.pg_proc p ON p.oid = pg_catalog.to_regprocedure(t.signature);

  PERFORM pg_catalog.set_config('librecarga.nc_publica_replay_catalog', v_before::text, true);
  PERFORM pg_catalog.set_config('librecarga.nc_publica_replay_txid',
    pg_catalog.pg_current_xact_id()::text, true);
END;
$nc_parity_pre$;

-- Exact reviewed source variants, before financial DDL.
-- Hashes cover the original UTF-8 prosrc or pg_get_functiondef bytes, unchanged.
-- No case folding, whitespace removal, trim or comment normalization is allowed.
-- Explicit variants: legacy migration, reviewed dump source, new wrapper and
-- effective balance literals. Reader hashes pin the reported installed forms.
-- Unknown bodies fail. The internal helper is preserved byte-for-byte by the
-- complete pg_proc snapshot; its unseen installed source is never rewritten.
DO $nc_parity_source_allowlist$
DECLARE
  v_signature text;
  v_definition_sha text;
  v_source_sha text;
  v_language text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.nc_aplicadas_en_moneda_factura(uuid)',
    'public._saldo_factura_calc(uuid)'
  ] LOOP
    SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
             pg_catalog.pg_get_functiondef(p.oid), 'UTF8')), 'hex'),
           pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
             p.prosrc, 'UTF8')), 'hex'), l.lanname::text
    INTO STRICT v_definition_sha, v_source_sha, v_language
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_language l ON l.oid = p.prolang
    WHERE p.oid = pg_catalog.to_regprocedure(v_signature);
    IF (v_signature = 'public.nc_aplicadas_en_moneda_factura(uuid)'
        AND v_definition_sha <> '7cdbbfa5aa99fa798a5758a824d2f8df50fcd485928d226e1061aabee01f2462'
        AND NOT ((v_language = 'plpgsql' AND v_source_sha IN (
          '020404e1439b746df4ffc9fffd7f97bc1813e8d9347cd42bd07c04a1f383b5b6',
          'd558f51439dc4e1c77fefff6c209ad2dcb4bb4333bd3be1ff9cf2a2d03e4f824'))
          OR (v_language = 'sql' AND v_source_sha = '74b6f31561ad298d62d27bfa784af6c8994ea68f980d592bb0c9c68b2adfdfba')))
       OR (v_signature = 'public._saldo_factura_calc(uuid)'
           AND v_definition_sha <> '8d75d77b4c4cd6a0f189ccbda9336e95f8d17e091807f2e0d14715c148a83df7'
           AND v_source_sha NOT IN (
             '1ce098d08383ebf2b8c284985c17ff3b7b3b1a3b39d39dd7d71dc565c7f4564f',
             '651a3ad9a1f360b76916dc4f916cf8e7cbbadd8629026464d9da558e8205cfb1')) THEN
      RAISE EXCEPTION 'NC_PARITY_SOURCE: unreviewed exact source for %', v_signature;
    END IF;
  END LOOP;
END;
$nc_parity_source_allowlist$;

-- MUST be a separate statement immediately before the first financial DDL.
-- In autocommit the local GUC from the first DO disappears, so this fails
-- before any CREATE/REVOKE/GRANT when the runner stops on errors.
DO $nc_parity_transaction$
BEGIN
  IF pg_catalog.current_setting('librecarga.nc_publica_replay_txid', true)
       IS DISTINCT FROM pg_catalog.pg_current_xact_id()::text
     OR NULLIF(pg_catalog.current_setting('librecarga.nc_publica_replay_catalog', true), '') IS NULL THEN
    RAISE EXCEPTION 'NC_PARITY_TRANSACTION: preconditions and DDL require one caller transaction';
  END IF;
END;
$nc_parity_transaction$;


-- Paridad de replay: restaurar el wrapper publico a la autoridad interna.
-- AUD-ANALISIS-7 incluyo Timbrada en interno/saldo, pero el replay de septiembre
-- habia reemitido el publico con una formula propia limitada a Aplicada.
-- Saldo: reemision literal del cuerpo efectivo tras AUD-ANALISIS-7, sin cambio
-- de calculo; permite mantener el espejo sin excepciones al auditor estatico.
-- CREATE OR REPLACE conserva las firmas y sus owners; la ACL vigente de ambos
-- helpers DEFINER sigue cerrada a PUBLIC, anon y authenticated.
-- No redefine _nc_aplicadas_moneda_factura ni sus ACL/metadatos.
CREATE OR REPLACE FUNCTION public.nc_aplicadas_en_moneda_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public._nc_aplicadas_moneda_factura(p_factura_id);
$function$;

REVOKE ALL ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._saldo_factura_calc(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_moneda text; v_tc numeric; v_estado estado_factura;
  v_pagos numeric; v_ncs numeric;
BEGIN
  SELECT f.total, f.moneda::text, f.tipo_cambio, f.estado
    INTO v_total, v_moneda, v_tc, v_estado
  FROM public.facturas f
  WHERE f.id = p_factura_id AND f.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_estado IN ('Cancelada', 'Sustituida') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(p.monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura p
  WHERE p.factura_id = p_factura_id AND p.deleted_at IS NULL
    AND NOT public.pago_rep_anulado(p.estado_rep);

  SELECT COALESCE(SUM(public.nc_convertida_a_moneda_factura(
           nc.monto, nc.moneda::text, nc.tipo_cambio, v_moneda, v_tc)), 0)
    INTO v_ncs
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = p_factura_id
    AND nc.deleted_at IS NULL
    AND nc.estado IN ('Timbrada','Aplicada');

  RETURN COALESCE(v_total, 0) - COALESCE(v_pagos, 0) - COALESCE(v_ncs, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public._saldo_factura_calc(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._saldo_factura_calc(uuid) TO service_role;

DO $nc_parity_post$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_wrapper pg_catalog.pg_proc%ROWTYPE;
BEGIN
  IF pg_catalog.current_setting('librecarga.nc_publica_replay_txid', true)
       IS DISTINCT FROM pg_catalog.pg_current_xact_id()::text
     OR NULLIF(pg_catalog.current_setting('librecarga.nc_publica_replay_catalog', true), '') IS NULL THEN
    RAISE EXCEPTION 'NC_PARITY_TRANSACTION: postconditions must share the precondition transaction';
  END IF;
  v_before := pg_catalog.current_setting('librecarga.nc_publica_replay_catalog', true)::jsonb;
  SELECT pg_catalog.jsonb_object_agg(t.signature,
    CASE t.kind
      WHEN 'wrapper' THEN pg_catalog.to_jsonb(p) - ARRAY['prosrc','prolang']::text[]
      WHEN 'balance' THEN pg_catalog.to_jsonb(p) - 'prosrc'
      ELSE pg_catalog.to_jsonb(p)
    END)
  INTO v_after
  FROM (VALUES
    ('public.nc_aplicadas_en_moneda_factura(uuid)', 'wrapper'),
    ('public._saldo_factura_calc(uuid)', 'balance'),
    ('public._nc_aplicadas_moneda_factura(uuid)', 'internal')
  ) t(signature, kind)
  JOIN pg_catalog.pg_proc p ON p.oid = pg_catalog.to_regprocedure(t.signature);
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'NC_PARITY_PRESERVATION: OID, owner, exact ACL, configuration, security or another preserved attribute changed';
  END IF;

  SELECT p.* INTO STRICT v_wrapper FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure('public.nc_aplicadas_en_moneda_factura(uuid)');
  IF v_wrapper.prolang IS DISTINCT FROM
       (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'sql')
     OR pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
       v_wrapper.prosrc, 'UTF8')), 'hex')
       IS DISTINCT FROM '74b6f31561ad298d62d27bfa784af6c8994ea68f980d592bb0c9c68b2adfdfba' THEN
    RAISE EXCEPTION 'NC_PARITY_DELEGATION: wrapper must be the reviewed SQL delegate';
  END IF;
  IF (SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
       p.prosrc, 'UTF8')), 'hex')
      FROM pg_catalog.pg_proc p
      WHERE p.oid = pg_catalog.to_regprocedure('public._saldo_factura_calc(uuid)'))
     IS DISTINCT FROM '1ce098d08383ebf2b8c284985c17ff3b7b3b1a3b39d39dd7d71dc565c7f4564f' THEN
    RAISE EXCEPTION 'NC_PARITY_BALANCE_BODY: balance must retain the reviewed effective financial body';
  END IF;

  -- Do not clear the transaction-local state here: it expires at transaction
  -- end and remains available to local verification until then.
END;
$nc_parity_post$;
