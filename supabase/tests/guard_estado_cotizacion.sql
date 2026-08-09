-- C5 + A3 · guard de estados de cotización: housekeeping y reactivación.
-- Antes no existía ninguna transición hacia 'Archivada' ni salida de
-- 'Vencida'/'Archivada': el cron de housekeeping hacía rollback completo y el
-- botón "Reactivar" fallaba siempre.
DO $$
DECLARE
  v_org uuid;
  v_cli uuid;
  v_cot uuid;
  v_estado text;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST GUARD COT', 'TGC000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  -- `clientes` no tiene `razon_social`; el nombre fiscal vive en `nombre`.
  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE GUARD COT', 'XAXX010101000', 'guard-cot@test.local')
  RETURNING id INTO v_cli;

  -- Con importes: el trigger `_cotizaciones_bloquear_envio_sin_importes`
  -- impide pasar a 'Enviada' una cotización sin total de venta.
  INSERT INTO public.cotizaciones (organization_id, cliente_id, estado, folio, modo, tipo, conceptos_venta)
  VALUES (v_org, v_cli, 'Borrador'::public.estado_cotizacion, 'COT-GUARD-0001',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
          '[{"descripcion":"FLETE GUARD","cantidad":1,"precio_unitario":1000,"moneda":"USD","aplica_iva":false}]'::jsonb)
  RETURNING id INTO v_cot;

  -- Borrador → Vencida (ya permitido)
  UPDATE public.cotizaciones SET estado = 'Vencida'::public.estado_cotizacion WHERE id = v_cot;

  -- C5: Vencida → Archivada debe permitirse (paso 4c del cron)
  UPDATE public.cotizaciones SET estado = 'Archivada'::public.estado_cotizacion WHERE id = v_cot;
  SELECT estado::text INTO v_estado FROM public.cotizaciones WHERE id = v_cot;
  IF v_estado <> 'Archivada' THEN
    RAISE EXCEPTION 'C5 FAIL: Vencida → Archivada no se aplicó (estado=%)', v_estado;
  END IF;

  -- A3: Archivada → Borrador (reactivación manual)
  UPDATE public.cotizaciones SET estado = 'Borrador'::public.estado_cotizacion WHERE id = v_cot;
  SELECT estado::text INTO v_estado FROM public.cotizaciones WHERE id = v_cot;
  IF v_estado <> 'Borrador' THEN
    RAISE EXCEPTION 'A3 FAIL: Archivada → Borrador no se aplicó (estado=%)', v_estado;
  END IF;

  -- A3: Vencida → Enviada (reactivación restaurando estado_anterior)
  UPDATE public.cotizaciones SET estado = 'Vencida'::public.estado_cotizacion WHERE id = v_cot;
  UPDATE public.cotizaciones SET estado = 'Enviada'::public.estado_cotizacion WHERE id = v_cot;

  -- Sigue bloqueada una transición inválida
  BEGIN
    UPDATE public.cotizaciones SET estado = 'En operación'::public.estado_cotizacion WHERE id = v_cot;
    RAISE EXCEPTION 'GUARD FAIL: Enviada → En operación debería estar prohibida';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE '%LC_COT_TRANSICION_INVALIDA%' THEN
      RAISE;
    END IF;
  END;

  DELETE FROM public.cotizaciones WHERE id = v_cot;
  DELETE FROM public.clientes WHERE id = v_cli;
  DELETE FROM public.organizations WHERE id = v_org;

  RAISE NOTICE 'OK guard_estado_cotizacion (C5 + A3)';
END$$;
