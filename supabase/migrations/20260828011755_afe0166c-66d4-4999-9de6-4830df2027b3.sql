-- =====================================================================
-- Ola 9 · Auditoría 3-3: M2 (T/C DOF en facturas en moneda extranjera),
-- C1b (fuente única de saldo) y M4 (alta canónica de clientes).
-- =====================================================================

-- ---------------------------------------------------------------------
-- M2 · Toda factura en moneda extranjera nace con el T/C DOF de su fecha
-- de emisión. Cubre TODAS las rutas de creación (conversión de proformas,
-- manual, refacturación) en un solo punto, en lugar de parchear cada RPC.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._factura_tc_dof_obligatorio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_tc numeric;
  v_fecha date;
BEGIN
  IF NEW.moneda::text = 'MXN' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.tipo_cambio, 0) > 1 THEN
    RETURN NEW;
  END IF;

  v_fecha := COALESCE(NEW.fecha_emision, (now() AT TIME ZONE 'America/Mexico_City')::date);

  SELECT CASE
           WHEN NEW.moneda::text = 'USD' THEN d.usd_mxn
           WHEN NEW.moneda::text = 'EUR' THEN d.eur_mxn
         END
    INTO v_tc
  FROM public.tc_dof_vigente(v_fecha) d;

  IF COALESCE(v_tc, 0) <= 1 THEN
    RAISE EXCEPTION 'LC_FACTURA_SIN_TC_DOF: no hay tipo de cambio DOF para % al %; captúralo antes de generar la factura',
      NEW.moneda, v_fecha
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

-- ---------------------------------------------------------------------
-- C1b · cartera_pendiente deja de duplicar la fórmula de conversión de
-- notas de crédito y usa el canon public.nc_aplicadas_en_moneda_factura.
-- Firma intacta (16 columnas) para no romper 42P13.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cartera_pendiente()
RETURNS TABLE(factura_id uuid, numero text, cliente_id uuid, cliente_nombre text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_vencido integer,
  moneda text, total numeric, pagado numeric, saldo numeric,
  ultimo_contacto date, estado text, cancellation_status text)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH base AS (
    SELECT f.id, f.numero, f.cliente_id, f.embarque_id, f.fecha_emision,
      f.fecha_vencimiento, f.moneda::text AS moneda, f.total,
      f.estado::text AS estado, f.cliente_nombre, f.tipo_cambio AS factura_tc,
      COALESCE(f.cancellation_status, 'none') AS cancellation_status,
      COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                 WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL),0) AS pagado,
      COALESCE(public.nc_aplicadas_en_moneda_factura(f.id), 0) AS nc_aplicadas
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
  )
  SELECT b.id, b.numero, b.cliente_id, COALESCE(c.nombre, b.cliente_nombre),
    b.embarque_id, e.expediente,
    b.fecha_emision, b.fecha_vencimiento,
    ((now() AT TIME ZONE 'America/Mexico_City')::date - b.fecha_vencimiento)::int,
    b.moneda, b.total, b.pagado,
    (b.total - b.pagado - b.nc_aplicadas),
    (SELECT MAX(cs.fecha) FROM public.cobranza_seguimiento cs WHERE cs.factura_id=b.id),
    b.estado, b.cancellation_status
  FROM base b
  LEFT JOIN public.clientes c ON c.id = b.cliente_id
  LEFT JOIN public.embarques e ON e.id = b.embarque_id AND e.deleted_at IS NULL
  WHERE (b.total - b.pagado - b.nc_aplicadas) > 0.005
  ORDER BY b.fecha_vencimiento ASC NULLS LAST
  LIMIT 500
$function$;

REVOKE ALL ON FUNCTION public.cartera_pendiente() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cartera_pendiente() FROM anon;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- M4 · Alta canónica de clientes. Se cierra el INSERT directo por API y
-- se valida la completitud fiscal cuando el cliente lleva RFC.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_clientes(p_clientes jsonb)
RETURNS SETOF public.clientes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_row jsonb;
  v_rfc text;
  v_nombre text;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
BEGIN
  IF p_clientes IS NULL OR jsonb_typeof(p_clientes) <> 'array'
     OR jsonb_array_length(p_clientes) = 0 THEN
    RAISE EXCEPTION 'LC_CLIENTE_PAYLOAD_INVALIDO: se esperaba un arreglo de clientes'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_clientes) > 1000 THEN
    RAISE EXCEPTION 'LC_CLIENTE_LOTE_EXCEDIDO: máximo 1000 clientes por llamada'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (
    public.has_any_role(v_uid, ARRAY['admin'::public.app_role, 'admin_org'::public.app_role,
                                     'operador'::public.app_role, 'contador'::public.app_role,
                                     'super_admin'::public.app_role])
  ) THEN
    RAISE EXCEPTION 'LC_CLIENTE_SIN_PERMISO: tu rol no puede dar de alta clientes'
      USING ERRCODE = '42501';
  END IF;

  v_org := public.current_user_org_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_CLIENTE_SIN_ORG: no hay organización activa'
      USING ERRCODE = '22023';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_clientes) LOOP
    v_nombre := btrim(COALESCE(v_row->>'nombre', ''));
    IF v_nombre = '' THEN
      RAISE EXCEPTION 'LC_CLIENTE_SIN_NOMBRE: la razón social es obligatoria'
        USING ERRCODE = '22023';
    END IF;

    v_rfc := upper(btrim(COALESCE(v_row->>'rfc', '')));

    -- Cliente facturable = trae RFC propio. Entonces el CFDI necesita datos
    -- fiscales completos desde el alta, no al momento de timbrar.
    IF v_rfc <> '' AND v_rfc NOT IN ('XEXX010101000', 'XAXX010101000') THEN
      IF btrim(COALESCE(v_row->>'regimen_fiscal', '')) = ''
         OR btrim(COALESCE(v_row->>'uso_cfdi_default', '')) = ''
         OR btrim(COALESCE(v_row->>'cp', '')) = ''
         OR btrim(COALESCE(v_row->>'direccion', '')) = '' THEN
        RAISE EXCEPTION 'LC_CLIENTE_FISCAL_INCOMPLETO: % lleva RFC, así que necesita régimen fiscal, uso de CFDI, código postal y dirección', v_nombre
          USING ERRCODE = '22023';
      END IF;
    END IF;

    INSERT INTO public.clientes (
      organization_id, nombre, rfc, direccion, ciudad, estado, cp, contacto,
      telefono, email, regimen_fiscal, uso_cfdi_default, dias_credito,
      limite_credito_mxn, sin_comision,
      requiere_autorizacion_cotizacion, requiere_autorizacion_proforma
    ) VALUES (
      v_org,
      v_nombre,
      NULLIF(v_rfc, ''),
      NULLIF(btrim(COALESCE(v_row->>'direccion', '')), ''),
      NULLIF(btrim(COALESCE(v_row->>'ciudad', '')), ''),
      NULLIF(btrim(COALESCE(v_row->>'estado', '')), ''),
      NULLIF(btrim(COALESCE(v_row->>'cp', '')), ''),
      NULLIF(btrim(COALESCE(v_row->>'contacto', '')), ''),
      NULLIF(btrim(COALESCE(v_row->>'telefono', '')), ''),
      NULLIF(lower(btrim(COALESCE(v_row->>'email', ''))), ''),
      NULLIF(btrim(COALESCE(v_row->>'regimen_fiscal', '')), ''),
      NULLIF(btrim(COALESCE(v_row->>'uso_cfdi_default', '')), ''),
      COALESCE((v_row->>'dias_credito')::int, 0),
      NULLIF(v_row->>'limite_credito_mxn', '')::numeric,
      COALESCE((v_row->>'sin_comision')::boolean, false),
      COALESCE((v_row->>'requiere_autorizacion_cotizacion')::boolean, false),
      COALESCE((v_row->>'requiere_autorizacion_proforma')::boolean, false)
    ) RETURNING id INTO v_id;

    v_ids := array_append(v_ids, v_id);
  END LOOP;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo,
    entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_org, v_uid, (SELECT email FROM auth.users WHERE id = v_uid),
    'cliente.alta', 'clientes', v_ids[1],
    (SELECT nombre FROM public.clientes WHERE id = v_ids[1]),
    jsonb_build_object('cantidad', array_length(v_ids, 1))
  );

  RETURN QUERY SELECT * FROM public.clientes WHERE id = ANY(v_ids);
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_clientes(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_clientes(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.crear_clientes(jsonb) TO authenticated, service_role;

-- El alta directa por API deja de estar disponible: sólo la RPC canónica.
REVOKE INSERT ON TABLE public.clientes FROM authenticated;
DROP POLICY IF EXISTS "Tenant write clientes" ON public.clientes;
