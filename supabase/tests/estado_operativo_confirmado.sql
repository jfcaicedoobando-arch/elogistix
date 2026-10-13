-- ETD/ETA son previsiones: jamás acreditan salida o arribo en los tableros.
-- Fixture aislado y reversible; prueba las ocho funciones y tenant/papelera.
BEGIN;
CREATE TEMP TABLE estado_operativo_fixture (id uuid, esperado text);
DO $$
DECLARE
  v_org uuid; v_other uuid; v_uid uuid := gen_random_uuid(); v_cli uuid; v_other_cli uuid;
  v_seq int := 98100; v_id uuid; v_fn text; v_def text; v_out jsonb; v_count bigint; v_forecast bigint;
  v_case record; v_row jsonb; v_expected text;
  v_today date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  INSERT INTO public.organizations(nombre,rfc,plan,activo)
    VALUES ('TEST estado operativo','SEO000000XX0','basico',true) RETURNING id INTO v_org;
  INSERT INTO public.organizations(nombre,rfc,plan,activo)
    VALUES ('TEST otro tenant estado','SEO000000XX1','basico',true) RETURNING id INTO v_other;
  INSERT INTO auth.users(id,email) VALUES(v_uid,'estado-operativo@test.invalid');
  INSERT INTO public.organization_members(organization_id,user_id,role)
    VALUES(v_org,v_uid,'admin_org');
  INSERT INTO public.user_roles(user_id,role) VALUES(v_uid,'admin_org') ON CONFLICT DO NOTHING;
  INSERT INTO public.clientes(organization_id,nombre,rfc,email)
    VALUES(v_org,'Cliente estado operativo','','estado@test.invalid') RETURNING id INTO v_cli;
  FOR v_case IN SELECT * FROM (VALUES
    ('Confirmado',-10,10), ('Confirmado',-20,-10), ('Confirmado',10,20),
    ('Confirmado',NULL::int,NULL::int), ('Confirmado',0,10),
    ('En Tránsito',10,20), ('En Tránsito',-20,-10), ('Arribo',-20,-10),
    ('Borrador',-20,-10), ('Cancelado',-20,-10)
  ) AS c(estado,etd_offset,eta_offset) LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.embarques(organization_id,cliente_id,expediente,modo,tipo,estado,etd,eta,operador)
    VALUES(v_org,v_cli,'ELIMP'||v_seq::text,'Marítimo','Importación',
      v_case.estado::public.estado_embarque,v_today+v_case.etd_offset,v_today+v_case.eta_offset,'TEST SALIDA')
    RETURNING id INTO v_id;
    INSERT INTO estado_operativo_fixture VALUES(v_id,v_case.estado);
  END LOOP;
  -- Otros modos también conservan el estado explícito ante fechas vencidas.
  FOR v_case IN SELECT * FROM (VALUES ('Aéreo'),('Terrestre')) AS c(modo) LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.embarques(organization_id,cliente_id,expediente,modo,tipo,estado,etd,eta,operador)
      VALUES(v_org,v_cli,'ELIMP'||v_seq::text,v_case.modo::public.modo_transporte,
        'Importación','Confirmado',v_today-20,v_today-10,'TEST SALIDA') RETURNING id INTO v_id;
    INSERT INTO estado_operativo_fixture VALUES(v_id,'Confirmado');
  END LOOP;
  INSERT INTO public.clientes(organization_id,nombre,rfc,email)
    VALUES(v_other,'Cliente otro tenant','','otro-estado@test.invalid') RETURNING id INTO v_other_cli;
  INSERT INTO public.embarques(organization_id,cliente_id,expediente,modo,tipo,estado,etd,eta)
    VALUES(v_other,v_other_cli,'ELIMP98198','Marítimo','Importación','Arribo',v_today-20,v_today-10);
  INSERT INTO public.embarques(organization_id,cliente_id,expediente,modo,tipo,estado,etd,eta,deleted_at)
    VALUES(v_org,v_cli,'ELIMP98199','Marítimo','Importación','Arribo',v_today-20,v_today-10,now());
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);

  FOREACH v_fn IN ARRAY ARRAY['dashboard_summary_datos','dashboard_details_datos','operaciones_stats',
    'dashboard_stats','_dashboard_summary_calc','_dashboard_details_calc','sidebar_alert_counts','embarques_alertas_ids'] LOOP
    v_def := pg_get_functiondef(('public.'||v_fn||'()')::regprocedure);
    IF v_fn NOT IN ('sidebar_alert_counts','embarques_alertas_ids') THEN
      EXECUTE format('SELECT public.%I()',v_fn) INTO v_out;
      IF v_fn IN ('dashboard_summary_datos','dashboard_stats','_dashboard_summary_calc') THEN
        IF (v_out #>> '{conteoPorEstado,Confirmado}')::int IS DISTINCT FROM 7
           OR (v_out #>> '{conteoPorEstado,En Tránsito}')::int IS DISTINCT FROM 2
           OR (v_out #>> '{conteoPorEstado,Arribo}')::int IS DISTINCT FROM 1
           OR (v_out ->> 'totalActivos')::int IS DISTINCT FROM 10 THEN
          RAISE EXCEPTION '%: conteo incorrecto por fechas, tenant o papelera: %',v_fn,v_out;
        END IF;
      END IF;
      IF v_fn = 'dashboard_summary_datos' THEN
        SELECT count(*) INTO v_forecast FROM public.embarques
          WHERE organization_id=v_org AND deleted_at IS NULL AND estado NOT IN ('Borrador','Cancelado')
            AND eta BETWEEN date_trunc('month',v_today)::date
              AND (date_trunc('month',v_today)+interval '1 month - 1 day')::date;
        IF (v_out #>> '{arribosEsteMes,total}')::bigint IS DISTINCT FROM v_forecast THEN
          RAISE EXCEPTION '% perdió previsión por ETA: % vs %',v_fn,v_out,v_forecast;
        END IF;
      END IF;
      FOR v_row IN SELECT jsonb_path_query(v_out,'$.** ? (@.id != null && @.estadoReal != null)') LOOP
        SELECT esperado INTO v_expected FROM estado_operativo_fixture WHERE id=(v_row->>'id')::uuid;
        IF v_expected IS NULL OR (v_row->>'estadoReal') IS DISTINCT FROM v_expected THEN
          RAISE EXCEPTION '% falseó etiqueta de estado: %',v_fn,v_row;
        END IF;
      END LOOP;
    END IF;
    IF v_def ~ '(v_hoy|current_date)\s*<\s*e\.etd' THEN
      RAISE EXCEPTION '% todavía deriva estado por ETD',v_fn;
    END IF;
    IF v_fn NOT IN ('sidebar_alert_counts','embarques_alertas_ids') THEN
      IF v_def !~ 'e\.estado::text AS estado_real' THEN
        RAISE EXCEPTION '% perdió el estado operativo persistido',v_fn;
      END IF;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM estado_operativo_fixture f JOIN public.embarques e ON e.id=f.id WHERE e.estado::text IS DISTINCT FROM f.esperado) THEN
    RAISE EXCEPTION 'La consulta mutó un estado persistido';
  END IF;
  SELECT embarques_demora INTO v_count FROM public.sidebar_alert_counts();
  IF v_count <> 1 THEN RAISE EXCEPTION 'sidebar: ETA vencida sin Arribo real generó demora: %',v_count; END IF;
  SELECT count(*) INTO v_count FROM public.embarques_alertas_ids() WHERE tipo='demora';
  IF v_count <> 1 THEN RAISE EXCEPTION 'alertas: ETA vencida sin Arribo real generó demora: %',v_count; END IF;
  IF EXISTS(SELECT 1 FROM public.embarques_alertas_ids() a LEFT JOIN estado_operativo_fixture f ON f.id=a.embarque_id
            WHERE a.tipo='demora' AND f.esperado IS DISTINCT FROM 'Arribo') THEN
    RAISE EXCEPTION 'alertas: identificador no pertenece al arribo real del tenant';
  END IF;
  RAISE NOTICE 'OK: ocho funciones usan estado persistido; fechas vencidas/futuras/nulas, tenant y papelera cubiertos';
END $$;
ROLLBACK;
