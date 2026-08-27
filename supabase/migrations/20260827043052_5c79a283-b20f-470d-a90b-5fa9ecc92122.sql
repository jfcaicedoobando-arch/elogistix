-- 1) Folio con prefijo COT-P para cotizaciones de prospecto (secuencia propia por org/año)
CREATE OR REPLACE FUNCTION public.siguiente_folio_cotizacion_prospecto()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.current_user_org_id();
  v_num bigint;
  v_anio text := to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYYY');
  v_tipo text := 'cotizacion_prospecto_' || v_anio;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_NO_RESUELTA: no se pudo determinar la organización';
  END IF;
  INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
  VALUES (v_org, v_tipo, 1)
  ON CONFLICT (organization_id, tipo)
  DO UPDATE SET ultimo_numero = folio_secuencias.ultimo_numero + 1,
                updated_at = now()
  RETURNING ultimo_numero INTO v_num;
  RETURN 'COT-P-' || v_anio || '-' || lpad(v_num::text, 4, '0');
END;
$function$;
-- H6: higiene de permisos — sólo authenticated ejecuta, nunca anon
REVOKE ALL ON FUNCTION public.siguiente_folio_cotizacion_prospecto() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siguiente_folio_cotizacion_prospecto() TO authenticated;

-- 2) Candado de integridad prospecto vs. cliente en cotizaciones
CREATE OR REPLACE FUNCTION public._cotizaciones_validar_prospecto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.es_prospecto, false) THEN
    -- Prospecto: jamás ligado a un cliente y siempre con empresa capturada.
    IF NEW.cliente_id IS NOT NULL THEN
      RAISE EXCEPTION 'LC_COT_PROSPECTO_CON_CLIENTE: una cotización de prospecto no puede tener cliente ligado';
    END IF;
    IF NULLIF(btrim(COALESCE(NEW.prospecto_empresa, '')), '') IS NULL THEN
      RAISE EXCEPTION 'LC_COT_PROSPECTO_SIN_EMPRESA: captura la empresa del prospecto';
    END IF;
  ELSIF NEW.cliente_id IS NULL AND NEW.estado <> 'Borrador' THEN
    -- Cliente: fuera de borrador, la cotización exige cliente ligado.
    RAISE EXCEPTION 'LC_COT_CLIENTE_REQUERIDO: una cotización de cliente requiere cliente ligado';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cotizaciones_validar_prospecto ON public.cotizaciones;
CREATE TRIGGER trg_cotizaciones_validar_prospecto
  BEFORE INSERT OR UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public._cotizaciones_validar_prospecto();

-- 3) Conversión prospecto → cliente: re-vincula TODAS las cotizaciones del prospecto
CREATE OR REPLACE FUNCTION public.convertir_prospecto_a_cliente_rpc(p_cotizacion_id uuid, p_cliente jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_es_prospecto boolean;
  v_cliente_id uuid;
  v_nombre text;
  v_rfc text;
  v_creado boolean := false;
  v_oportunidad_id uuid;
  v_lead_id uuid;
  v_empresa text;
  v_revinculadas int;
BEGIN
  SELECT organization_id, es_prospecto, cliente_id, oportunidad_id,
         NULLIF(btrim(COALESCE(prospecto_empresa, '')), '')
    INTO v_org, v_es_prospecto, v_cliente_id, v_oportunidad_id, v_empresa
  FROM public.cotizaciones WHERE id = p_cotizacion_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  -- Idempotencia: si ya se convirtió, devolver el cliente existente.
  IF v_cliente_id IS NOT NULL AND COALESCE(v_es_prospecto, false) = false THEN
    SELECT nombre INTO v_nombre FROM public.clientes WHERE id = v_cliente_id;
    RETURN jsonb_build_object('cliente_id', v_cliente_id, 'nombre', v_nombre, 'creado', false);
  END IF;

  v_nombre := NULLIF(btrim(COALESCE(p_cliente->>'nombre', '')), '');
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'LC_CLIENTE_SIN_NOMBRE';
  END IF;
  v_rfc := NULLIF(btrim(upper(COALESCE(p_cliente->>'rfc', ''))), '');

  -- Reutiliza cliente existente con el mismo RFC dentro de la organización.
  -- RG2: los RFC genéricos del SAT (XAXX010101000 público en general,
  -- XEXX010101000 extranjeros) no identifican a nadie: nunca matchean.
  IF v_rfc IS NOT NULL AND v_rfc NOT IN ('XAXX010101000', 'XEXX010101000') THEN
    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE organization_id = v_org AND upper(btrim(rfc)) = v_rfc AND deleted_at IS NULL
      AND upper(btrim(rfc)) NOT IN ('XAXX010101000', 'XEXX010101000')
    LIMIT 1;
  ELSE
    v_cliente_id := NULL;
  END IF;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (
      organization_id, nombre, contacto, email, telefono, rfc, direccion, ciudad, estado, cp
    ) VALUES (
      v_org,
      v_nombre,
      COALESCE(p_cliente->>'contacto', ''),
      COALESCE(p_cliente->>'email', ''),
      COALESCE(p_cliente->>'telefono', ''),
      COALESCE(v_rfc, ''),
      COALESCE(p_cliente->>'direccion', ''),
      COALESCE(p_cliente->>'ciudad', ''),
      COALESCE(p_cliente->>'estado', ''),
      COALESCE(p_cliente->>'cp', '')
    )
    RETURNING id INTO v_cliente_id;
    v_creado := true;
  END IF;

  UPDATE public.cotizaciones
     SET cliente_id = v_cliente_id,
         cliente_nombre = v_nombre,
         es_prospecto = false,
         updated_at = now()
   WHERE id = p_cotizacion_id;

  -- Re-vincula el historial: otras cotizaciones del mismo prospecto (misma
  -- empresa normalizada, misma org, aún sin cliente) pasan al cliente nuevo.
  v_revinculadas := 0;
  IF v_empresa IS NOT NULL THEN
    UPDATE public.cotizaciones
       SET cliente_id = v_cliente_id,
           cliente_nombre = v_nombre,
           es_prospecto = false,
           updated_at = now()
     WHERE organization_id = v_org
       AND id <> p_cotizacion_id
       AND deleted_at IS NULL
       AND COALESCE(es_prospecto, false) = true
       AND cliente_id IS NULL
       AND lower(btrim(prospecto_empresa)) = lower(v_empresa);
    GET DIAGNOSTICS v_revinculadas = ROW_COUNT;
  END IF;

  -- Propagación CRM atómica: oportunidad y lead quedan ligados al cliente.
  IF v_oportunidad_id IS NOT NULL THEN
    UPDATE public.crm_oportunidades
       SET cliente_id = v_cliente_id,
           cliente_nombre = v_nombre,
           updated_at = now()
     WHERE id = v_oportunidad_id AND organization_id = v_org
    RETURNING lead_id INTO v_lead_id;

    IF v_lead_id IS NOT NULL THEN
      UPDATE public.crm_leads
         SET estado = 'Convertido'::crm_lead_estado,
             cliente_convertido_id = v_cliente_id,
             oportunidad_convertida_id = v_oportunidad_id,
             updated_at = now()
       WHERE id = v_lead_id AND organization_id = v_org;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'cliente_id', v_cliente_id, 'nombre', v_nombre, 'creado', v_creado,
    'oportunidad_id', v_oportunidad_id, 'lead_id', v_lead_id,
    'cotizaciones_revinculadas', v_revinculadas
  );
END;
$function$;