CREATE OR REPLACE FUNCTION public.tg_pfc_validar_vinculo_costo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cc_moneda   text;
  v_cc_monto    numeric;
  v_cc_prov     uuid;
  v_cc_org      uuid;
  v_expediente  text;
  v_fac_folio   text;
  v_fac_moneda  text;
  v_fac_prov    uuid;
  v_fac_org     uuid;
  v_fac_tc      numeric;
  v_asignado    numeric;
  v_par_mxn_usd boolean;
BEGIN
  IF NEW.concepto_costo_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.concepto_costo_id IS NOT DISTINCT FROM OLD.concepto_costo_id
     AND NEW.proveedor_factura_id IS NOT DISTINCT FROM OLD.proveedor_factura_id
     AND NEW.monto IS NOT DISTINCT FROM OLD.monto THEN
    RETURN NEW;
  END IF;

  SELECT cc.moneda, cc.monto, cc.proveedor_id, cc.organization_id
    INTO v_cc_moneda, v_cc_monto, v_cc_prov, v_cc_org
    FROM public.conceptos_costo cc
   WHERE cc.id = NEW.concepto_costo_id
     AND cc.deleted_at IS NULL
   FOR UPDATE;

  IF v_cc_org IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_VINCULO_COSTO_INEXISTENTE: el concepto de costo no existe o fue eliminado'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT e.expediente INTO v_expediente
    FROM public.conceptos_costo cc
    JOIN public.embarques e ON e.id = cc.embarque_id
   WHERE cc.id = NEW.concepto_costo_id;

  SELECT COALESCE(pf.folio_interno, pf.folio_proveedor), pf.moneda,
         pf.proveedor_id, pf.organization_id, pf.tipo_cambio_usd
    INTO v_fac_folio, v_fac_moneda, v_fac_prov, v_fac_org, v_fac_tc
    FROM public.proveedor_facturas pf
   WHERE pf.id = NEW.proveedor_factura_id;

  IF v_fac_org IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_FACTURA_NO_EXISTE: la factura de proveedor no existe'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_fac_org IS DISTINCT FROM v_cc_org THEN
    RAISE EXCEPTION 'LC_CXP_VINCULO_ORG: la factura % y el costo del expediente % pertenecen a organizaciones distintas',
      COALESCE(v_fac_folio, '(sin folio)'), COALESCE(v_expediente, '(sin expediente)')
      USING ERRCODE = '42501';
  END IF;

  IF v_cc_prov IS NOT NULL AND v_fac_prov IS NOT NULL AND v_cc_prov IS DISTINCT FROM v_fac_prov THEN
    RAISE EXCEPTION 'LC_CXP_VINCULO_PROVEEDOR: la factura % es de otro proveedor que el costo del expediente %',
      COALESCE(v_fac_folio, '(sin folio)'), COALESCE(v_expediente, '(sin expediente)')
      USING ERRCODE = 'P0001';
  END IF;

  IF upper(btrim(COALESCE(v_fac_moneda, ''))) IS DISTINCT FROM upper(btrim(COALESCE(v_cc_moneda, ''))) THEN
    -- Conversión permitida SÓLO entre MXN y USD y SÓLO con el tipo de cambio
    -- congelado en la factura (`proveedor_facturas.tipo_cambio_usd`). Sin TC no
    -- se puede auditar el importe convertido: se rechaza.
    v_par_mxn_usd :=
      ARRAY[upper(btrim(COALESCE(v_fac_moneda, ''))), upper(btrim(COALESCE(v_cc_moneda, '')))]
        <@ ARRAY['MXN','USD'];

    IF NOT v_par_mxn_usd THEN
      RAISE EXCEPTION 'LC_CXP_VINCULO_MONEDA: la factura % está en % y el costo del expediente % en %; sólo se pueden conciliar monedas distintas entre MXN y USD',
        COALESCE(v_fac_folio, '(sin folio)'), COALESCE(v_fac_moneda, '(sin moneda)'),
        COALESCE(v_expediente, '(sin expediente)'), COALESCE(v_cc_moneda, '(sin moneda)')
        USING ERRCODE = 'P0001';
    END IF;

    IF COALESCE(v_fac_tc, 0) <= 1 THEN
      RAISE EXCEPTION 'LC_CXP_VINCULO_TC_REQUERIDO: la factura % está en % y el costo del expediente % en %; captura el tipo de cambio de la factura antes de vincularlos',
        COALESCE(v_fac_folio, '(sin folio)'), COALESCE(v_fac_moneda, '(sin moneda)'),
        COALESCE(v_expediente, '(sin expediente)'), COALESCE(v_cc_moneda, '(sin moneda)')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT COALESCE(sum(pfc.monto), 0)
    INTO v_asignado
    FROM public.proveedor_facturas_conceptos pfc
   WHERE pfc.concepto_costo_id = NEW.concepto_costo_id
     AND (TG_OP = 'INSERT' OR pfc.id <> NEW.id);

  -- El tope sólo aplica cuando factura y costo comparten moneda; convertido con
  -- TC la comparación directa de importes no es válida.
  IF COALESCE(v_cc_monto, 0) > 0
     AND upper(btrim(COALESCE(v_fac_moneda, ''))) = upper(btrim(COALESCE(v_cc_moneda, '')))
     AND round(v_asignado + COALESCE(NEW.monto, 0), 2) > round(v_cc_monto * 1.05, 2) THEN
    RAISE EXCEPTION 'LC_CXP_VINCULO_SOBREASIGNADO: el costo del expediente % es de % % y ya tiene % asignado; la factura % excede el monto restante',
      COALESCE(v_expediente, '(sin expediente)'), v_cc_monto, COALESCE(v_cc_moneda, ''),
      v_asignado, COALESCE(v_fac_folio, '(sin folio)')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pfc_validar_vinculo_costo ON public.proveedor_facturas_conceptos;
CREATE TRIGGER trg_pfc_validar_vinculo_costo
BEFORE INSERT OR UPDATE ON public.proveedor_facturas_conceptos
FOR EACH ROW EXECUTE FUNCTION public.tg_pfc_validar_vinculo_costo();

REVOKE ALL ON FUNCTION public.tg_pfc_validar_vinculo_costo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tg_pfc_validar_vinculo_costo() TO authenticated, service_role;