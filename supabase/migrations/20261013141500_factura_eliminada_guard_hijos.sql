BEGIN;
-- Fail closed before CREATE OR REPLACE: all three functions must already exist
-- with reviewed bodies/security/search_path. Exact target hashes allow reapplication.
-- REP and substitution also accept the exact squash bodies (blob a74b0a5d2ab96ea720d414e388bf6f203649a606):
-- only 4 and 12 empty separator lines differ from their source migrations.
-- Keep original remote preimages; do not normalize, recompute or accept arbitrary hashes.
-- Capture existing owner/ACL without rewriting or broadening them.
DO $preconditions$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES
    ('public._nc_validar_linaje_conceptos()', true, ARRAY['3ead908da81f25c72424f0ceb88e6099','e8bce96bfa2d9edb6569333ca3fe18aa']::text[]),
    ('public.assert_factura_viva_para_rep()', false, ARRAY['10621bffc7289d11acf116b24f9fe966','40badfd37ee72215f3b81c21c3f0bc50','0c2bac8a98f9398940c5cb22c3092208']::text[]),
    ('public.duplicar_factura_para_sustitucion(uuid)', true, ARRAY['51cd445e39365a256a4864cf1d871cb3','e0b8bdc97556afd0cba54c11104eebfb','d1ed6e79d2cf281f3b9088cc3492042a']::text[])
    ) expected(signature, security_definer, body_hashes)
    LEFT JOIN pg_proc p ON p.oid = to_regprocedure(expected.signature)
    WHERE p.oid IS NULL OR p.prosecdef IS DISTINCT FROM expected.security_definer
      OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
      OR NOT (md5(p.prosrc) = ANY(expected.body_hashes))
  ) THEN
    RAISE EXCEPTION 'LC_FACTURA_HIJOS_PRECONDITION: función ausente o distinta de la revisada';
  END IF;
END;
$preconditions$;
CREATE TEMP TABLE factura_hijos_metadata ON COMMIT DROP AS
SELECT oid, proowner, proacl, prosecdef, proconfig, prorettype, proargtypes
FROM pg_proc WHERE oid IN (
  'public._nc_validar_linaje_conceptos()'::regprocedure,
  'public.assert_factura_viva_para_rep()'::regprocedure,
  'public.duplicar_factura_para_sustitucion(uuid)'::regprocedure
);

-- Defensa acotada: padres eliminados en NC, REP y sustitución.
-- Forward-only: conserva SECURITY, search_path, firmas, permisos y datos.
-- No altera pagos individuales idempotentes ni las consultas históricas.
-- CREATE OR REPLACE mantiene ACL; no se incluyen cambios de roles/grants.

CREATE OR REPLACE FUNCTION public._nc_validar_linaje_conceptos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  r record;
  v_f record;
  v_fx numeric;
  v_otras numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.estado = 'Cancelada' THEN
    RETURN NEW;
  END IF;
  -- La relación activa exige padre vigente del mismo tenant, incluso en
  -- borradores manuales/sin linaje. No modifica la lectura histórica.
  SELECT moneda::text AS moneda, tipo_cambio INTO v_f
  FROM public.facturas
  WHERE id = NEW.factura_id AND organization_id = NEW.organization_id
    AND deleted_at IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_NC_FACTURA_NO_VIVA: la factura no está disponible para una nota de crédito'
      USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_typeof(NEW.conceptos) IS DISTINCT FROM 'array' THEN
    RETURN NEW;
  END IF;
  v_fx := public._nc_factor_moneda_factura(NEW.moneda::text, NEW.tipo_cambio, v_f.moneda, v_f.tipo_cambio);
  FOR r IN
    SELECT lower(btrim(l->>'concepto_factura_id')) AS cfid,
           SUM(round(COALESCE((l->>'cantidad')::numeric, 1) * COALESCE((l->>'precio_unitario')::numeric, 0), 2)) AS base
    FROM jsonb_array_elements(NEW.conceptos) l
    WHERE NULLIF(btrim(l->>'concepto_factura_id'), '') IS NOT NULL
    GROUP BY 1
  LOOP
    IF r.cfid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR NOT EXISTS (
      SELECT 1 FROM public.conceptos_factura cf
      WHERE cf.id = r.cfid::uuid AND cf.factura_id = NEW.factura_id
        AND cf.organization_id = NEW.organization_id AND cf.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'LC_NC_LINAJE_INVALIDO: un renglón de la nota no pertenece a la factura.'
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT COALESCE(SUM(round(COALESCE((l->>'cantidad')::numeric, 1) * COALESCE((l->>'precio_unitario')::numeric, 0), 2)
             * public._nc_factor_moneda_factura(o.moneda::text, o.tipo_cambio, v_f.moneda, v_f.tipo_cambio)), 0)
      INTO v_otras
    FROM public.factura_notas_credito o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(o.conceptos) = 'array' THEN o.conceptos ELSE '[]'::jsonb END) l
    WHERE o.factura_id = NEW.factura_id AND o.organization_id = NEW.organization_id
      AND o.id <> NEW.id AND o.deleted_at IS NULL AND o.estado <> 'Cancelada'
      AND lower(btrim(l->>'concepto_factura_id')) = r.cfid;
    IF r.base * v_fx + v_otras > (SELECT round(cf.cantidad * cf.precio_unitario, 2)
                                  FROM public.conceptos_factura cf WHERE cf.id = r.cfid::uuid) + 0.01 THEN
      RAISE EXCEPTION 'LC_NC_EXCEDE_CONCEPTO: la nota acredita más que el subtotal del concepto original.'
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_rep()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_uuid_fiscal text;
BEGIN
  -- Sólo validamos cuando la fila realmente está timbrando un REP.
  -- Un pago sin uuid_rep ni facturapi_rep_id no timbra REP por definición,
  -- sin importar el valor de estado_rep (que puede ser 'NoAplica' por default).
  IF NEW.uuid_rep IS NULL AND NEW.facturapi_rep_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT estado::text, uuid_fiscal
    INTO v_estado, v_uuid_fiscal
  FROM public.facturas
  WHERE id = NEW.factura_id AND organization_id = NEW.organization_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REP_FACTURA_NO_VIVA: la factura no está disponible para REP'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_uuid_fiscal IS NULL THEN
    RAISE EXCEPTION 'LC_REP_FACTURA_SIN_TIMBRAR: no se puede timbrar REP de una factura sin UUID fiscal'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_estado IN ('Cancelada','Sustituida','Borrador') THEN
    RAISE EXCEPTION 'LC_REP_FACTURA_NO_VIVA: la factura está en estado % y no admite REP', v_estado
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('estado_factura', v_estado)::text;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.duplicar_factura_para_sustitucion(p_factura_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_old public.facturas%ROWTYPE;
  v_sust_estado text;
  v_new_id uuid := gen_random_uuid();
  v_new_numero text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_old FROM public.facturas
  WHERE id = p_factura_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'factura_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_caller
      AND organization_id = v_old.organization_id
      AND role IN ('admin_org','admin','super_admin','contador','auxiliar_contable','tesorero')
  ) THEN
    RAISE EXCEPTION 'forbidden: requiere rol admin, contador o tesorero' USING ERRCODE = '42501';
  END IF;

  IF v_old.uuid_fiscal IS NULL THEN
    RAISE EXCEPTION 'factura_sin_uuid: sólo se puede sustituir un CFDI timbrado' USING ERRCODE = 'P0001';
  END IF;

  IF v_old.sustituida_por IS NOT NULL THEN
    SELECT estado::text INTO v_sust_estado FROM public.facturas WHERE id = v_old.sustituida_por;
    IF v_sust_estado IS NOT NULL AND v_sust_estado NOT IN ('Cancelada','Sustituida') THEN
      RAISE EXCEPTION 'factura_ya_sustituida' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_old.estado = 'Cancelada' THEN
    RAISE EXCEPTION 'factura_ya_cancelada' USING ERRCODE = 'P0001';
  END IF;

  v_new_numero := v_old.numero || '-R';
  WHILE EXISTS (SELECT 1 FROM public.facturas WHERE organization_id = v_old.organization_id AND numero = v_new_numero) LOOP
    v_new_numero := v_new_numero || '1';
  END LOOP;

  INSERT INTO public.facturas (
    id, organization_id, cliente_id, cliente_nombre, expediente,
    cotizacion_id, embarque_id, proforma_id,
    numero, serie, serie_id,
    fecha_emision, fecha_vencimiento, dias_credito,
    moneda, tipo_cambio, subtotal, iva, total,
    metodo_pago, forma_pago, uso_cfdi, rfc_cliente,
    notas, referencia_bl,
    snapshot_emision,
    estado, origen,
    sustituye_a
  ) VALUES (
    v_new_id, v_old.organization_id, v_old.cliente_id, v_old.cliente_nombre, v_old.expediente,
    v_old.cotizacion_id, v_old.embarque_id, v_old.proforma_id,
    v_new_numero, v_old.serie, v_old.serie_id,
    CURRENT_DATE, CURRENT_DATE + COALESCE(v_old.dias_credito, 0), v_old.dias_credito,
    v_old.moneda, v_old.tipo_cambio, v_old.subtotal, v_old.iva, v_old.total,
    v_old.metodo_pago, v_old.forma_pago, v_old.uso_cfdi, v_old.rfc_cliente,
    COALESCE(v_old.notas, '') || E'\n[Sustituye a ' || v_old.numero || ']',
    v_old.referencia_bl,
    NULL,
    'Borrador', v_old.origen,
    v_old.id
  );

  UPDATE public.facturas SET sustituida_por = v_new_id WHERE id = v_old.id;

  INSERT INTO public.conceptos_factura (
    factura_id, organization_id,
    descripcion, cantidad, precio_unitario, moneda, total,
    clave_sat, tipo_iva, tasa_iva_aplicada,
    tasa_ret_isr, tasa_ret_iva, monto_ret_isr, monto_ret_iva,
    clave_unidad, embarque_id, proforma_id_origen
  )
  SELECT
    v_new_id, v_old.organization_id,
    descripcion, cantidad, precio_unitario, moneda, total,
    clave_sat, tipo_iva, tasa_iva_aplicada,
    tasa_ret_isr, tasa_ret_iva, monto_ret_isr, monto_ret_iva,
    clave_unidad, embarque_id, proforma_id_origen
  FROM public.conceptos_factura
  WHERE factura_id = v_old.id
    AND deleted_at IS NULL;

  -- Copiar los vínculos con embarques (tabla puente) al borrador sustituto.
  -- La original queda con activa=false al cancelarse; la nueva nace activa.
  INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id, activa)
  SELECT v_new_id, embarque_id, organization_id, true
  FROM public.factura_embarques
  WHERE factura_id = v_old.id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_old.organization_id,
    v_caller,
    COALESCE((SELECT email FROM auth.users WHERE id = v_caller), ''),
    'factura_duplicada_para_sustitucion',
    'facturacion',
    v_new_id,
    COALESCE(v_new_numero, ''),
    jsonb_build_object('factura_original_id', v_old.id, 'factura_original_uuid', v_old.uuid_fiscal, 'numero_nuevo', v_new_numero)
  );

  RETURN v_new_id;
END;
$function$;

-- Conservar la validación al restaurar o cambiar padre/tenant/estado de una NC.
DROP TRIGGER IF EXISTS trg_nc_validar_linaje_conceptos ON public.factura_notas_credito;
CREATE TRIGGER trg_nc_validar_linaje_conceptos
  BEFORE INSERT OR UPDATE OF conceptos, factura_id, moneda, tipo_cambio, organization_id, deleted_at, estado
  ON public.factura_notas_credito FOR EACH ROW
  EXECUTE FUNCTION public._nc_validar_linaje_conceptos();

-- Un REP existente tampoco puede ligarse a otro padre eliminado/tenant.
DROP TRIGGER IF EXISTS trg_pago_factura_rep_viva ON public.pagos_factura;
CREATE TRIGGER trg_pago_factura_rep_viva
  BEFORE INSERT OR UPDATE OF uuid_rep, estado_rep, facturapi_rep_id, factura_id, organization_id
  ON public.pagos_factura FOR EACH ROW
  WHEN (NEW.uuid_rep IS NOT NULL OR NEW.facturapi_rep_id IS NOT NULL)
  EXECUTE FUNCTION public.assert_factura_viva_para_rep();

DO $metadata$
BEGIN
  IF EXISTS (
    SELECT 1 FROM factura_hijos_metadata b LEFT JOIN pg_proc p ON p.oid = b.oid
    WHERE p.oid IS NULL OR p.proowner IS DISTINCT FROM b.proowner
      OR p.proacl IS DISTINCT FROM b.proacl OR p.prosecdef IS DISTINCT FROM b.prosecdef
      OR p.proconfig IS DISTINCT FROM b.proconfig OR p.prorettype IS DISTINCT FROM b.prorettype
      OR p.proargtypes IS DISTINCT FROM b.proargtypes
  ) THEN
    RAISE EXCEPTION 'LC_FACTURA_HIJOS_METADATA: cambió identidad, propietario, ACL, seguridad o firma';
  END IF;
END;
$metadata$;
COMMIT;
