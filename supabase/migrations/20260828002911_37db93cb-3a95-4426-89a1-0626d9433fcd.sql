-- Ola 5 (auditoría 3 · C9): los costos y la utilidad ya no viajan en el JSON
-- de los dashboards para roles que la UI se los oculta, y el rol `viewer`
-- pierde la policy que le dejaba leer `cotizacion_costos`.

-- 1) Regla única de "puede ver costos" (espejo de COST_VIEWERS en
--    src/lib/access/permissionMatrix.ts).
CREATE OR REPLACE FUNCTION public.puede_ver_costos_dashboard(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL AND public.has_any_role_efectivo(
    _user_id,
    ARRAY['admin','admin_org','super_admin','gerente_operaciones','gerente_visor',
          'gerente_comercial','contador','tesorero','auxiliar_contable',
          'ejecutivo_cobranza']::app_role[]
  );
$$;

REVOKE ALL ON FUNCTION public.puede_ver_costos_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_ver_costos_dashboard(uuid) TO authenticated, service_role;

-- 2) Enmascarado recursivo: pone en NULL las llaves de costo/utilidad/margen
--    conservando el shape del JSON que consume el front.
CREATE OR REPLACE FUNCTION public.enmascarar_costos_jsonb(p_in jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_out jsonb;
  v_key text;
  v_val jsonb;
  v_elem jsonb;
  v_llaves text[] := ARRAY[
    'costoUSD','costoMXN','costoEUR','costo_usd','costo_mxn',
    'profitUSD','profitMXN','profit_usd','profit_mxn',
    'utilidadUSD','utilidadMXN',
    'margen','margenUSD','margenMXN'
  ];
BEGIN
  IF p_in IS NULL THEN
    RETURN NULL;
  END IF;

  CASE jsonb_typeof(p_in)
    WHEN 'object' THEN
      v_out := '{}'::jsonb;
      FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_in) LOOP
        IF v_key = ANY (v_llaves) THEN
          v_out := v_out || jsonb_build_object(v_key, 'null'::jsonb);
        ELSE
          v_out := v_out || jsonb_build_object(v_key, public.enmascarar_costos_jsonb(v_val));
        END IF;
      END LOOP;
      RETURN v_out;
    WHEN 'array' THEN
      v_out := '[]'::jsonb;
      FOR v_elem IN SELECT value FROM jsonb_array_elements(p_in) LOOP
        v_out := v_out || jsonb_build_array(public.enmascarar_costos_jsonb(v_elem));
      END LOOP;
      RETURN v_out;
    ELSE
      RETURN p_in;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.enmascarar_costos_jsonb(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enmascarar_costos_jsonb(jsonb) TO authenticated, service_role;

-- 3) El cálculo de los dashboards pasa a funciones internas y las RPC públicas
--    quedan como envoltura que enmascara según el rol. Se evita duplicar los
--    cuerpos (deuda M6: parcheo por texto).
ALTER FUNCTION public.dashboard_details() RENAME TO dashboard_details_datos;
ALTER FUNCTION public.dashboard_summary() RENAME TO dashboard_summary_datos;

REVOKE ALL ON FUNCTION public.dashboard_details_datos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_details_datos() TO service_role;
REVOKE ALL ON FUNCTION public.dashboard_summary_datos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_summary_datos() TO service_role;

CREATE OR REPLACE FUNCTION public.dashboard_details()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_out jsonb;
BEGIN
  v_out := public.dashboard_details_datos();
  IF NOT public.puede_ver_costos_dashboard(auth.uid()) THEN
    v_out := public.enmascarar_costos_jsonb(v_out);
  END IF;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_out jsonb;
BEGIN
  v_out := public.dashboard_summary_datos();
  IF NOT public.puede_ver_costos_dashboard(auth.uid()) THEN
    v_out := public.enmascarar_costos_jsonb(v_out);
  END IF;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_details() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_details() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_summary() TO authenticated, service_role;

-- 4) El rol `viewer` ya no lee costos de cotización: contradecía
--    `puede_ver_costos_cotizacion` (que no lo incluye).
DROP POLICY IF EXISTS "Tenant viewer cotizacion_costos" ON public.cotizacion_costos;