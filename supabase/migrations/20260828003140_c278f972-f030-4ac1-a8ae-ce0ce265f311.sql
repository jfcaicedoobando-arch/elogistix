-- Ola 5 (C9) · refuerzo: regla por prefijo en lugar de lista fija, para cubrir
-- desgloses (costoMxnFromUsd, costoMxnNative, gastosOperativosMXN, …).
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