DO $mig$
DECLARE def text; nuevo text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
    FROM pg_proc p WHERE p.proname = 'crm_cerrar_oportunidad_desde_cotizacion';
  IF def IS NULL OR position('FOR UPDATE OF o;' in def) = 0 THEN RETURN; END IF;
  nuevo := replace(def,
'  SELECT o.id, o.organization_id, o.vendedor_id, o.nombre, e.tipo,
         o.cotizacion_ganadora_id, o.valor_real, o.embarque_ganador_id, o.moneda
    INTO v_op_id, v_op_org, v_op_vendedor, v_op_nombre, v_etapa_tipo,
         v_ganadora, v_valor_previo, v_emb_ganador, v_op_moneda
    FROM public.crm_oportunidades o
    JOIN public.crm_etapas_pipeline e ON e.id = o.etapa_id
   WHERE o.id = NEW.oportunidad_id
     AND o.organization_id = NEW.organization_id
     AND o.deleted_at IS NULL
   FOR UPDATE OF o;',
'  -- El lock se toma sobre la tabla SOLA: un FOR UPDATE OF o con JOIN, al
  -- despertar tras esperar a otra transaccion, reevalua el join completo
  -- (EvalPlanQual) y puede devolver 0 filas aunque la oportunidad exista,
  -- disparando un falso LC_OPORTUNIDAD_AJENA en aceptaciones concurrentes.
  SELECT o.id INTO v_op_id
    FROM public.crm_oportunidades o
   WHERE o.id = NEW.oportunidad_id
     AND o.organization_id = NEW.organization_id
     AND o.deleted_at IS NULL
   FOR UPDATE;

  IF v_op_id IS NOT NULL THEN
    SELECT o.organization_id, o.vendedor_id, o.nombre, e.tipo,
           o.cotizacion_ganadora_id, o.valor_real, o.embarque_ganador_id, o.moneda
      INTO v_op_org, v_op_vendedor, v_op_nombre, v_etapa_tipo,
           v_ganadora, v_valor_previo, v_emb_ganador, v_op_moneda
      FROM public.crm_oportunidades o
      JOIN public.crm_etapas_pipeline e ON e.id = o.etapa_id
     WHERE o.id = v_op_id;
  END IF;');
  IF nuevo = def THEN
    RAISE EXCEPTION 'LC_MIG_NO_APLICADA: no se encontro el bloque de lock esperado';
  END IF;
  EXECUTE nuevo;
END
$mig$;