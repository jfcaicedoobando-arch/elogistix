CREATE OR REPLACE FUNCTION public._assert_iva_proforma_coherente(p_tipo text, p_tasa numeric, p_aplica boolean)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $function$
BEGIN
  IF p_tipo IS NULL OR p_tipo NOT IN ('gravado_16', 'gravado_8', 'tasa_0', 'exento', 'no_objeto') THEN
    RAISE EXCEPTION 'LC_PROFORMA_IVA_PENDIENTE: clasifica explícitamente el tratamiento de IVA antes de generar o convertir'
      USING ERRCODE = 'P0001';
  END IF;
  IF (p_tipo IN ('gravado_16', 'gravado_8') AND (
        p_aplica IS FALSE OR (p_tasa IS NULL AND p_aplica IS NOT TRUE)
        OR (p_tasa IS NOT NULL AND abs(p_tasa - CASE WHEN p_tipo = 'gravado_8' THEN 0.08 ELSE 0.16 END) >= 0.000000001)))
     OR (p_tipo IN ('tasa_0', 'exento', 'no_objeto') AND (
        COALESCE(p_tasa, 0) <> 0 OR (p_tipo <> 'tasa_0' AND p_aplica IS TRUE))) THEN
    RAISE EXCEPTION 'LC_PROFORMA_IVA_INCOHERENTE: tratamiento, tasa y traslado no coinciden; revisa el concepto y la proforma antes de facturar'
      USING ERRCODE = 'P0001';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._assert_iva_proforma_coherente(text, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._assert_iva_proforma_coherente(text, numeric, boolean) TO service_role;
