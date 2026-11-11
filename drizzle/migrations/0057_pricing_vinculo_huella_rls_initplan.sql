-- Actualiza la huella fija de políticas en crm_vincular_cotizacion_cliente_pricing
-- tras 0047 (auth.uid() envuelto en SELECT). Sólo cambia el literal $policies$;
-- predicados, permisos y ACL quedan idénticos.
DO $mig$
DECLARE
  v_def text;
  v_parts text[];
  v_pol text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)'::regprocedure) INTO v_def;
  v_parts := string_to_array(v_def, '$policies$');
  IF array_length(v_parts, 1) <> 3 THEN
    RAISE EXCEPTION 'huella $policies$ no encontrada';
  END IF;
  v_pol := v_parts[2];
  v_pol := replace(v_pol, 'has_role(auth.uid(), ''cliente''::app_role) AND (cliente_id IN',
                          'has_role(( SELECT auth.uid() AS uid), ''cliente''::app_role) AND (cliente_id IN');
  v_pol := replace(v_pol, '(created_by = auth.uid())', '(created_by = ( SELECT auth.uid() AS uid))');
  IF v_pol ~ 'auth\.uid\(\), ''cliente''' OR v_pol ~ 'created_by = auth\.uid\(\)' THEN
    RAISE EXCEPTION 'reemplazo incompleto';
  END IF;
  v_new := v_parts[1] || '$policies$' || v_pol || '$policies$' || v_parts[3];
  EXECUTE v_new;

  IF (SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename, policyname) FROM pg_catalog.pg_policies p
      WHERE schemaname='public' AND tablename IN ('clientes','costeo_agentes','costeo_tarifas','cotizaciones','crm_etapas_pipeline','crm_oportunidades','crm_solicitudes_pricing','organization_members'))
     IS DISTINCT FROM
     (SELECT substring(prosrc from '\$policies\$(.*?)\$policies\$')::jsonb FROM pg_proc
      WHERE oid='public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'la huella sigue sin coincidir';
  END IF;
END
$mig$;