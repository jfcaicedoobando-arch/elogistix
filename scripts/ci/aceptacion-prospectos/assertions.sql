-- Candidato ejecutable: requiere esquema completo + migración 20261012160000.
-- Sólo CI aislado. No ejecutado por la tarea frontend. Conserva todos los triggers.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
\i supabase/tests/rls/_helpers.sql

CREATE FUNCTION pg_temp.require_accept(_ok boolean, _message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF _ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALLA: %', _message; END IF;
END;
$$;
CREATE FUNCTION pg_temp.reject_accept(_sql text, _code text, _message text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    EXECUTE _sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE IS DISTINCT FROM _code OR position(_message in SQLERRM)=0 THEN
      RAISE EXCEPTION 'Error inesperado: % / %', SQLSTATE, SQLERRM;
    END IF;
    rejected := true;
  END;
  PERFORM pg_temp.require_accept(rejected, 'Se esperaba rechazo '||_message);
END;
$$;

DO $$
DECLARE
  fx record;
  org_a uuid := gen_random_uuid(); org_b uuid := gen_random_uuid(); gerente_b uuid := gen_random_uuid();
  operador uuid := gen_random_uuid(); vendedor uuid := gen_random_uuid();
  cliente_casa uuid := gen_random_uuid(); interna uuid := gen_random_uuid();
  abierta uuid := gen_random_uuid(); ganada uuid := gen_random_uuid();
  lead uuid; oportunidad uuid; cotizacion uuid; empresa uuid;
  tiene_empresa boolean; resultado jsonb; retry jsonb; nuevo_cliente uuid;
  sello record; sello_retry record; cantidad int;
  payload jsonb := '{"nombre":"Prospecto canónico","contacto":"Ana","email":"ana@test.local", "telefono":"5555555555","rfc":"XAXX010101000","direccion":"Calle 1","ciudad":"CDMX","estado":"CDMX","cp":"06600","regimen_fiscal":"601","uso_cfdi_default":"G03","forma_pago_default":"99","metodo_pago_default":"PPD"}'::jsonb;
BEGIN
  SELECT org_a AS org_a, org_b AS org_b, gerente_b AS admin_b INTO fx;
  -- Seeds estrictos de la referencia PR264: sin auto-org, FK intactos y sin skips.
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (operador,'gerente-a@test.invalid','{"skip_auto_org":"true"}'),
    (vendedor,'vendedor-a@test.invalid','{"skip_auto_org":"true"}'),
    (gerente_b,'gerente-b@test.invalid','{"skip_auto_org":"true"}');
  INSERT INTO public.organizations(id,nombre) VALUES
    (fx.org_a,'ACEPTAR PROSPECTO A'),(fx.org_b,'ACEPTAR PROSPECTO B');
  INSERT INTO public.organization_members(organization_id,user_id,role)
    VALUES(fx.org_a,operador,'gerente_operaciones'),(fx.org_a,vendedor,'vendedor'),
      (fx.org_b,gerente_b,'gerente_operaciones');
  -- El trigger de membership crea user_roles; no duplicar ni usar operador legacy.
  PERFORM pg_temp.require_accept((SELECT count(*)=3 FROM public.user_roles WHERE
    (user_id IN (operador,gerente_b) AND role::text='gerente_operaciones')
    OR (user_id=vendedor AND role::text='vendedor')),'Espejo real de membership exacto');
  INSERT INTO public.crm_etapas_pipeline(id,organization_id,nombre,tipo,orden,probabilidad_default,activa)
    VALUES(abierta,fx.org_a,'Abierta prueba aceptación','abierta',901,50,true),
          (ganada,fx.org_a,'Ganada prueba aceptación','ganada',902,100,true);
  INSERT INTO public.clientes(id,organization_id,nombre,rfc,email,requiere_autorizacion_cotizacion)
    VALUES(cliente_casa,fx.org_a,'Cliente interno','XAXX010101000','interno@test.local',false);
  INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,tipo_embarque,estado,cliente_id,cliente_nombre,
    es_prospecto,created_by,version,fecha_vigencia,conceptos_venta)
    VALUES(interna,fx.org_a,'COT-INTERNA-CRM-TEST','Marítimo','Importación','LCL','Borrador',cliente_casa,'Cliente interno',
      false,vendedor,3,CURRENT_DATE+15,'[{"concepto":"Flete","cantidad":1,"precio_unitario":1500,"moneda":"MXN"}]');

  PERFORM pg_temp.as_user(operador);
  resultado := public.aceptar_cotizacion_version(interna);
  retry := public.aceptar_cotizacion_version(interna);
  PERFORM pg_temp.require_accept(resultado->>'origen_aceptacion'='interna_cliente_de_casa','Casa sin CRM conserva origen');
  PERFORM pg_temp.require_accept((retry->>'sin_cambios')::boolean,'Retry casa no escribe');
  PERFORM pg_temp.as_postgres();

  -- Ambos casos son legítimos: sin vínculos empresa y con los dos linajes reales.
  FOREACH tiene_empresa IN ARRAY ARRAY[false,true] LOOP
    lead := gen_random_uuid(); oportunidad := gen_random_uuid(); cotizacion := gen_random_uuid(); empresa := gen_random_uuid();
    INSERT INTO public.crm_leads(id,organization_id,empresa,estado,vendedor_id)
      VALUES(lead,fx.org_a,'Prospecto canónico','Prospecto',vendedor);
    INSERT INTO public.crm_oportunidades(id,organization_id,nombre,lead_id,etapa_id,vendedor_id,moneda)
      VALUES(oportunidad,fx.org_a,'Oportunidad canónica',lead,abierta,vendedor,'MXN');
    IF tiene_empresa THEN
      INSERT INTO public.crm_empresas(id,organization_id,nombre,lead_origen_id,estado_crm)
        VALUES(empresa,fx.org_a,'Prospecto canónico',lead,'Prospecto');
      INSERT INTO public.crm_oportunidad_empresa(organization_id,oportunidad_id,empresa_id)
        VALUES(fx.org_a,oportunidad,empresa);
    END IF;
    INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,tipo_embarque,estado,cliente_id,es_prospecto,
      prospecto_empresa,oportunidad_id,created_by,version,fecha_vigencia,conceptos_venta)
      VALUES(cotizacion,fx.org_a,'COT-PROS-'||cotizacion::text,'Marítimo','Importación','LCL','Borrador',NULL,true,
        'Prospecto canónico',oportunidad,vendedor,4,CURRENT_DATE+15,
        '[{"concepto":"Flete","cantidad":1,"precio_unitario":2300,"moneda":"MXN"}]');
    -- prospecto_empresa es obligatorio. Enviar mantiene los triggers reales.
    UPDATE public.cotizaciones SET estado='Enviada' WHERE id=cotizacion;

    PERFORM pg_temp.as_user(vendedor);
    PERFORM pg_temp.reject_accept(format('SELECT public.aceptar_cotizacion_version(%L)',cotizacion),'42501','LC_SOD_VIOLATION');
    PERFORM pg_temp.as_user(fx.admin_b);
    PERFORM pg_temp.reject_accept(format('SELECT public.aceptar_cotizacion_version(%L)',cotizacion),'42501','LC_NO_AUTORIZADO');
    PERFORM pg_temp.as_postgres();
    -- El trigger sincroniza moneda al insertar: romperla DESPUÉS en la oportunidad.
    UPDATE public.crm_oportunidades SET moneda='USD' WHERE id=oportunidad;
    PERFORM pg_temp.as_user(operador);
    PERFORM pg_temp.reject_accept(format('SELECT public.aceptar_cotizacion_version(%L)',cotizacion),'P0001','LC_MONEDA_INCOMPATIBLE');
    PERFORM pg_temp.as_postgres();
    UPDATE public.crm_oportunidades SET moneda='MXN' WHERE id=oportunidad;
    PERFORM pg_temp.as_user(operador);
    resultado := public.aceptar_cotizacion_version(cotizacion);
    retry := public.aceptar_cotizacion_version(cotizacion);
    PERFORM pg_temp.require_accept(resultado->>'origen_aceptacion'='aceptacion_prospecto_crm','Prospecto nunca es de casa');
    PERFORM pg_temp.require_accept((retry->>'sin_cambios')::boolean,'Retry previo admite ganada/Pendiente de alta');
    PERFORM pg_temp.as_postgres();
    SELECT version_aceptada,aceptada_en,aceptada_por INTO sello FROM public.cotizaciones WHERE id=cotizacion;
    PERFORM pg_temp.require_accept(sello.version_aceptada=4 AND sello.aceptada_en IS NOT NULL AND sello.aceptada_por=operador,'Sello íntegro canónico');
    PERFORM pg_temp.require_accept((SELECT cliente_id IS NULL AND es_prospecto FROM public.cotizaciones WHERE id=cotizacion),'Aceptar no crea cliente');
    PERFORM pg_temp.require_accept((SELECT estado::text='Pendiente de alta' AND cliente_convertido_id IS NULL FROM public.crm_leads WHERE id=lead),'Lead no Convertido al aceptar');
    IF tiene_empresa THEN
      PERFORM pg_temp.require_accept((SELECT estado_crm='Prospecto' AND cliente_id IS NULL FROM public.crm_empresas WHERE id=empresa),'Empresa no Cliente al aceptar');
    END IF;
    PERFORM pg_temp.require_accept((SELECT o.cotizacion_ganadora_id=cotizacion AND e.tipo='ganada' AND o.valor_real=c.subtotal
      FROM public.crm_oportunidades o JOIN public.crm_etapas_pipeline e ON e.id=o.etapa_id
      JOIN public.cotizaciones c ON c.id=cotizacion WHERE o.id=oportunidad),'CRM gana con monto canónico');

    -- Fiscal incompleto: no debe existir cliente ni conversión parcial.
    SELECT count(*) INTO cantidad FROM public.clientes WHERE organization_id=fx.org_a;
    PERFORM pg_temp.as_user(operador);
    PERFORM pg_temp.reject_accept(format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',cotizacion,'{"nombre":"Incompleto"}'),
      'P0001','LC_CLIENTE_FISCAL_INCOMPLETO');
    PERFORM pg_temp.as_postgres();
    PERFORM pg_temp.require_accept((SELECT count(*)=cantidad FROM public.clientes WHERE organization_id=fx.org_a),'Fiscal incompleto no crea cliente');
    PERFORM pg_temp.require_accept((SELECT cliente_id IS NULL FROM public.cotizaciones WHERE id=cotizacion),'Fiscal incompleto no convierte');

    -- La RPC de conversión es la ORIGINAL; se ejecuta sólo después de ganar.
    PERFORM pg_temp.as_user(operador);
    resultado := public.convertir_prospecto_a_cliente_rpc(cotizacion,payload);
    nuevo_cliente := (resultado->>'cliente_id')::uuid;
    retry := public.aceptar_cotizacion_version(cotizacion);
    PERFORM pg_temp.require_accept((retry->>'sin_cambios')::boolean,'Retry convertido usa rama cliente original');
    PERFORM pg_temp.require_accept(retry->>'origen_aceptacion' = CASE
      WHEN public.cliente_requiere_autorizacion(nuevo_cliente,'cotizacion') THEN 'autorizacion_cliente'
      ELSE 'interna_cliente_de_casa' END,'Retry convertido recalcula origen según contrato cliente original');
    PERFORM pg_temp.as_postgres();
    SELECT version_aceptada,aceptada_en,aceptada_por INTO sello_retry FROM public.cotizaciones WHERE id=cotizacion;
    PERFORM pg_temp.require_accept(sello_retry IS NOT DISTINCT FROM sello,'Conversión/retry no reescriben sello');
    PERFORM pg_temp.require_accept((SELECT cliente_id=nuevo_cliente AND NOT es_prospecto FROM public.cotizaciones WHERE id=cotizacion),'Conversión original enlaza cliente');
    PERFORM pg_temp.require_accept((SELECT count(*)=1 FROM public.bitacora_actividad WHERE entidad_id=cotizacion
      AND accion='cotizacion.aceptada_version_fijada'),'Una auditoría de aceptación');
    PERFORM pg_temp.require_accept((SELECT count(*)=1 FROM public.bitacora_actividad WHERE entidad_id=cotizacion
      AND accion='convertir_prospecto_a_cliente'),'Una auditoría de conversión');
    PERFORM pg_temp.require_accept((SELECT count(*)=1 FROM public.crm_notificaciones WHERE user_id=vendedor
      AND tipo='oportunidad_ganada' AND link='/crm/oportunidades/'||oportunidad::text),'Una notificación de ganada');
  END LOOP;
  RAISE NOTICE 'OK: Aceptar → Convertir, cliente interno, retry antes/después, fiscal y moneda; empresas opcionales';
END;
$$;
ROLLBACK;
