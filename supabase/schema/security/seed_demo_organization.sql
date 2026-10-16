CREATE OR REPLACE FUNCTION public.seed_demo_organization()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- M8: sólo service_role (edge `demo-access`) o super_admin explícito.
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_NO_AUTORIZADO: solo service_role o super_admin'
      USING ERRCODE = 'P0001';
  END IF;

  -- Provisional fail-closed stop: conservation/adoption is not verified.
  -- No flag or skip window may enable destructive reseeding in this release.
  RAISE EXCEPTION 'LC_SEED_DEMO_CONSERVACION_PENDIENTE: reseed bloqueado hasta verificar conservación y adopción'
    USING ERRCODE = '55000';
  -- Candado de transacción: un solo re-sembrado a la vez.
  PERFORM pg_advisory_xact_lock(hashtext('seed_demo_organization'));

  -- Ola 4 (H7): antes el reseed fallaba por FK si alguien había operado en la
  -- demo (facturas/pagos generados después del último sembrado).
  PERFORM public._seed_demo_limpiar_financiero();

  PERFORM public.seed_demo_organization_core();
END;
$function$;
REVOKE ALL ON FUNCTION public.seed_demo_organization() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization() TO service_role, authenticated;
