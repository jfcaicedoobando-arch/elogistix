CREATE OR REPLACE FUNCTION public._tipo_iva_desde_tasa(_aplica_iva boolean, _tasa numeric)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tasa numeric;
BEGIN
  -- Exento: el concepto declara explícitamente que no causa IVA.
  IF _tasa IS NULL AND COALESCE(_aplica_iva, true) = false THEN
    RETURN 'exento';
  END IF;
  v_tasa := ROUND(COALESCE(_tasa, 0.16), 4);
  IF v_tasa = 0 THEN
    RETURN 'tasa_0';
  ELSIF v_tasa = 0.08 THEN
    RETURN 'gravado_8';
  ELSIF v_tasa = 0.16 THEN
    RETURN 'gravado_16';
  END IF;
  RAISE EXCEPTION 'LC_IVA_TASA_NO_SOPORTADA: la tasa de IVA % no es facturable (permitidas: 0%%, 8%%, 16%%)', v_tasa
    USING ERRCODE = '22023';
END;
$function$;

REVOKE ALL ON FUNCTION public._tipo_iva_desde_tasa(boolean, numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public._tipo_iva_desde_tasa(boolean, numeric) TO authenticated;
GRANT ALL ON FUNCTION public._tipo_iva_desde_tasa(boolean, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public._convertir_proformas_insertar_conceptos(p_factura_id uuid, p_proforma_ids uuid[], p_org uuid, p_es_consolidada boolean, p_moneda moneda)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_es_consolidada THEN
    INSERT INTO public.conceptos_factura (
      factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
      tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
    )
    SELECT p_factura_id, pcc.descripcion, pcc.cantidad, pcc.precio_unitario,
           pcc.moneda, pcc.total, p_org,
           COALESCE(public.resolver_clave_sat(p_org, pcc.descripcion), '78101800'),
           -- Defecto 1: 8% de frontera conserva su clasificación fiscal.
           public._tipo_iva_desde_tasa(pcc.aplica_iva, pcc.tasa_iva_aplicada),
           CASE
             WHEN pcc.tasa_iva_aplicada IS NULL AND pcc.aplica_iva = false THEN NULL
             ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16)
           END,
           p.embarque_id, pcc.proforma_id
    FROM public.proforma_conceptos_consolidados pcc
    JOIN public.proformas p ON p.id = pcc.proforma_id
    WHERE pcc.proforma_id = ANY(p_proforma_ids)
      AND pcc.moneda = p_moneda
      AND pcc.deleted_at IS NULL;
  ELSE
    INSERT INTO public.conceptos_factura (
      factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
      tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
    )
    SELECT p_factura_id, cv.descripcion, cv.cantidad, cv.precio_unitario,
           -- BUG-17: el total del renglón se guarda redondeado a 2 decimales,
           -- igual que en la rama consolidada (pcc.total ya viene redondeado).
           cv.moneda, ROUND(cv.cantidad * cv.precio_unitario, 2), p_org,
           COALESCE(public.resolver_clave_sat(p_org, cv.descripcion), '78101800'),
           public._tipo_iva_desde_tasa(cv.aplica_iva, cv.tasa_iva_aplicada),
           CASE
             WHEN cv.tasa_iva_aplicada IS NULL AND cv.aplica_iva = false THEN NULL
             ELSE COALESCE(cv.tasa_iva_aplicada, 0.16)
           END,
           p.embarque_id, cv.proforma_id
    FROM public.conceptos_venta cv
    JOIN public.proformas p ON p.id = cv.proforma_id
    WHERE cv.proforma_id = ANY(p_proforma_ids)
      AND cv.moneda = p_moneda
      AND cv.deleted_at IS NULL;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dof_dias_habiles_entre(_desde date, _hasta date)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(COUNT(*), 0)::int
  FROM generate_series(_desde + 1, _hasta - 1, INTERVAL '1 day') AS g(d)
  WHERE EXTRACT(ISODOW FROM g.d) < 6
$function$;

REVOKE ALL ON FUNCTION public.dof_dias_habiles_entre(date, date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.dof_dias_habiles_entre(date, date) TO authenticated;
GRANT ALL ON FUNCTION public.dof_dias_habiles_entre(date, date) TO service_role;

CREATE OR REPLACE FUNCTION public._factura_tc_dof_obligatorio()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tc numeric;
  v_fecha date;
  v_fecha_dof date;
  v_rezago int;
  -- Tolerancia de días hábiles sin publicación (puentes oficiales, Semana
  -- Santa). Más allá de esto el dato está obsoleto, no "pendiente".
  c_max_rezago_habil constant int := 2;
BEGIN
  -- Timbradas: inmutables por los guards fiscales existentes; no recalculamos.
  IF TG_OP = 'UPDATE' AND OLD.uuid_fiscal IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.moneda::text = 'MXN' THEN
    NEW.tipo_cambio := 1;
    RETURN NEW;
  END IF;

  -- El T/C NUNCA se toma de lo capturado: se resuelve del DOF vigente a la
  -- fecha de emisión, así que un valor arbitrario u obsoleto no persiste.
  v_fecha := COALESCE(NEW.fecha_emision, (now() AT TIME ZONE 'America/Mexico_City')::date);

  SELECT d.fecha,
         CASE
           WHEN NEW.moneda::text = 'USD' THEN d.usd_mxn
           WHEN NEW.moneda::text = 'EUR' THEN d.eur_mxn
         END
    INTO v_fecha_dof, v_tc
  FROM public.tc_dof_vigente(v_fecha) d;

  IF COALESCE(v_tc, 0) <= 1 THEN
    RAISE EXCEPTION 'LC_FACTURA_SIN_TC_DOF: no hay tipo de cambio DOF para % al %; captúralo antes de generar la factura',
      NEW.moneda, v_fecha
      USING ERRCODE = '22023';
  END IF;

  -- Defecto 2: el arrastre sólo se permite por días inhábiles.
  v_rezago := public.dof_dias_habiles_entre(v_fecha_dof, v_fecha);
  IF v_rezago > c_max_rezago_habil THEN
    RAISE EXCEPTION 'LC_FACTURA_TC_DOF_OBSOLETO: el tipo de cambio DOF más reciente es del % (% días hábiles antes del %); sincroniza el DOF o captúralo antes de facturar',
      v_fecha_dof, v_rezago, v_fecha
      USING ERRCODE = '22023';
  END IF;

  NEW.tipo_cambio := v_tc;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_factura_tc_dof_obligatorio ON public.facturas;
CREATE TRIGGER trg_factura_tc_dof_obligatorio
BEFORE INSERT ON public.facturas
FOR EACH ROW EXECUTE FUNCTION public._factura_tc_dof_obligatorio();

DROP TRIGGER IF EXISTS trg_factura_tc_dof_obligatorio_upd ON public.facturas;
CREATE TRIGGER trg_factura_tc_dof_obligatorio_upd
BEFORE UPDATE OF moneda, fecha_emision, tipo_cambio ON public.facturas
FOR EACH ROW EXECUTE FUNCTION public._factura_tc_dof_obligatorio();