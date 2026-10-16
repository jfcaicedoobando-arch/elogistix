CREATE OR REPLACE FUNCTION public.seed_demo_organization_guarded(p_skip_ms bigint DEFAULT 600000)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ultimo timestamptz;
  v_org constant uuid := 'de100000-0000-0000-0000-000000000001'::uuid;
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_NO_AUTORIZADO: solo service_role o super_admin'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('seed_demo_organization'));

  SELECT last_seeded_at INTO v_ultimo FROM public.demo_seed_state WHERE id = true;
  IF v_ultimo IS NOT NULL
     AND (extract(epoch FROM clock_timestamp()) - extract(epoch FROM v_ultimo)) * 1000 < p_skip_ms THEN
    RETURN false;
  END IF;

  -- Sentry JAVASCRIPT-REACT-80: agentes creados por visitantes de la demo
  -- (alta provisional) quedaban ligados a proveedores que el reseed borra y
  -- el SET NULL chocaba con proveedor_id NOT NULL. Sólo org demo.
  UPDATE public.crm_solicitudes_pricing SET tarifa_tarifario_id = NULL
   WHERE organization_id = v_org AND tarifa_tarifario_id IS NOT NULL;
  DELETE FROM public.costeo_cargos_fob_agente WHERE organization_id = v_org;
  DELETE FROM public.costeo_tarifas WHERE organization_id = v_org;
  DELETE FROM public.costeo_agentes WHERE organization_id = v_org;

  PERFORM public.seed_demo_organization_core();

  INSERT INTO public.demo_seed_state (id, last_seeded_at)
  VALUES (true, clock_timestamp())
  ON CONFLICT (id) DO UPDATE SET last_seeded_at = excluded.last_seeded_at;

  RETURN true;
END;
$function$;