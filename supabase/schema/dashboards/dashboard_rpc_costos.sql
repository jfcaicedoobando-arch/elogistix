-- Fuente canónica de las RPC públicas de dashboard con enmascarado de costos
-- (Ola 5 · auditoría 3 · hallazgo C9).
--
-- Analogía: el reporte es el mismo hoja para todos, pero a quien no le
-- corresponde ver el costo se le entrega con esas casillas en blanco, no con
-- la cifra tachada del otro lado del papel.
--
-- `dashboard_details_datos()` / `dashboard_summary_datos()` calculan (archivos
-- hermanos, sólo service_role). Estas envolturas ponen en NULL costo, utilidad
-- y margen para roles fuera de COST_VIEWERS (src/lib/access/permissionMatrix.ts).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

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
  v_prefijos text[] := ARRAY['costo','costos','profit','utilidad','margen','gastosoperativos'];
  v_sensible boolean;
  v_pref text;
BEGIN
  IF p_in IS NULL THEN
    RETURN NULL;
  END IF;

  CASE jsonb_typeof(p_in)
    WHEN 'object' THEN
      v_out := '{}'::jsonb;
      FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_in) LOOP
        v_sensible := false;
        FOREACH v_pref IN ARRAY v_prefijos LOOP
          IF lower(v_key) LIKE v_pref || '%' THEN
            v_sensible := true;
            EXIT;
          END IF;
        END LOOP;

        IF v_sensible THEN
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
