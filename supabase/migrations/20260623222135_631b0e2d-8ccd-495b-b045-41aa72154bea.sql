
-- 1) Columnas de auditoría / motivo
ALTER TABLE public.costeo_tarifas
  ADD COLUMN IF NOT EXISTS motivo_rechazo text,
  ADD COLUMN IF NOT EXISTS aprobada_por uuid,
  ADD COLUMN IF NOT EXISTS aprobada_en timestamptz;

-- 2) RPC con motivo + auditoría + notificación interna
CREATE OR REPLACE FUNCTION public.agente_aprobar_tarifa(
  _tarifa_id uuid, _estado text, _motivo text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_agente_id uuid;
  v_ruta_id uuid;
  v_agente_user uuid;
  v_ruta_txt text;
BEGIN
  IF _estado NOT IN ('vigente','rechazada','borrador') THEN
    RAISE EXCEPTION 'estado inválido: %', _estado;
  END IF;

  SELECT organization_id, agente_id, ruta_id
    INTO v_org, v_agente_id, v_ruta_id
    FROM public.costeo_tarifas WHERE id = _tarifa_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'tarifa no encontrada';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = v_org
        AND om.role IN ('admin','admin_org','gerente_operaciones','coordinador_logistico','ejecutivo_pricing','operador'))
  ) THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;

  IF _estado = 'rechazada' AND (coalesce(btrim(_motivo), '') = '' OR length(btrim(_motivo)) < 5) THEN
    RAISE EXCEPTION 'el motivo de rechazo es obligatorio (mínimo 5 caracteres)';
  END IF;

  IF _estado = 'vigente' THEN
    UPDATE public.costeo_tarifas
       SET estado_aprobacion = 'vigente',
           motivo_rechazo = NULL,
           aprobada_por = auth.uid(),
           aprobada_en = now(),
           updated_at = now()
     WHERE id = _tarifa_id;
  ELSIF _estado = 'rechazada' THEN
    UPDATE public.costeo_tarifas
       SET estado_aprobacion = 'rechazada',
           motivo_rechazo = btrim(_motivo),
           updated_at = now()
     WHERE id = _tarifa_id;
  ELSE -- borrador (reactivar)
    UPDATE public.costeo_tarifas
       SET estado_aprobacion = 'borrador',
           motivo_rechazo = NULL,
           updated_at = now()
     WHERE id = _tarifa_id;
  END IF;

  -- Notificar al usuario agente vinculado (si existe)
  SELECT user_id INTO v_agente_user
    FROM public.agente_users
   WHERE agente_id = v_agente_id
   LIMIT 1;

  IF v_agente_user IS NOT NULL AND _estado IN ('vigente','rechazada') THEN
    SELECT (po.name || ' → ' || pd.name)
      INTO v_ruta_txt
      FROM public.costeo_rutas r
      JOIN public.puertos po ON po.id = r.puerto_origen_id
      JOIN public.puertos pd ON pd.id = r.puerto_destino_id
     WHERE r.id = v_ruta_id;

    INSERT INTO public.notificaciones_internas (
      organization_id, user_id, tipo, titulo, mensaje, leida
    ) VALUES (
      v_org,
      v_agente_user,
      CASE WHEN _estado = 'vigente' THEN 'tarifa_aprobada' ELSE 'tarifa_rechazada' END,
      CASE WHEN _estado = 'vigente' THEN 'Tarifa aprobada' ELSE 'Tarifa rechazada' END,
      CASE WHEN _estado = 'vigente'
           THEN 'Tu tarifa ' || coalesce(v_ruta_txt,'') || ' fue aprobada y ya está vigente.'
           ELSE 'Tu tarifa ' || coalesce(v_ruta_txt,'') || ' fue rechazada. Motivo: ' || btrim(_motivo)
      END,
      false
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.agente_aprobar_tarifa(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_aprobar_tarifa(uuid, text, text) TO authenticated;

-- 3) Ampliar trigger force_borrador para limpiar motivo cuando el agente reedita una rechazada
CREATE OR REPLACE FUNCTION public.costeo_tarifas_agente_force_borrador()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'agente_carga') THEN
    IF TG_OP = 'UPDATE' AND OLD.estado_aprobacion IN ('vigente','reemplazada') THEN
      RAISE EXCEPTION 'no se puede editar una tarifa % directamente; duplica para crear una nueva versión', OLD.estado_aprobacion;
    END IF;
    NEW.estado_aprobacion := 'borrador';
    NEW.motivo_rechazo := NULL;
  END IF;
  RETURN NEW;
END;
$$;
