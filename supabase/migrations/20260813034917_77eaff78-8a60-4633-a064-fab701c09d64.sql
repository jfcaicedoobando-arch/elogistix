CREATE OR REPLACE FUNCTION public.seed_demo_organization_guarded(p_skip_ms bigint DEFAULT 600000)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ultimo timestamptz;
BEGIN
  -- M8 (mismo guard que seed_demo_organization): sólo service_role
  -- (edge demo-access) o super_admin explícito.
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_NO_AUTORIZADO: solo service_role o super_admin'
      USING ERRCODE = 'P0001';
  END IF;

  -- REF-05: candado + chequeo de edad + seed + marcador en UNA transacción
  -- (el chequeo previo en la edge era check-then-act).
  PERFORM pg_advisory_xact_lock(hashtext('seed_demo_organization'));

  SELECT last_seeded_at INTO v_ultimo FROM public.demo_seed_state WHERE id = true;
  IF v_ultimo IS NOT NULL
     AND (extract(epoch FROM clock_timestamp()) - extract(epoch FROM v_ultimo)) * 1000 < p_skip_ms THEN
    RETURN false; -- sembrado recientemente: omitir
  END IF;

  PERFORM public.seed_demo_organization_core();

  INSERT INTO public.demo_seed_state (id, last_seeded_at)
  VALUES (true, clock_timestamp())
  ON CONFLICT (id) DO UPDATE SET last_seeded_at = excluded.last_seeded_at;

  RETURN true; -- se re-sembró
END;
$function$;

REVOKE ALL ON FUNCTION public.seed_demo_organization_guarded(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_demo_organization_guarded(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.seed_demo_organization_guarded(bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization_guarded(bigint) TO service_role;

COMMENT ON FUNCTION public.seed_demo_organization_guarded(bigint) IS
  'REF-05: seed demo con skip de ventana atomico (candado + edad + seed + marcador en una transaccion). Devuelve true si sembro, false si se omitio.';