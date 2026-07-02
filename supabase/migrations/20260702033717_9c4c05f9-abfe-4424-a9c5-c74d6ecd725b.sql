
-- 1) Nuevos campos en public.proformas
ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS estado_cliente text NOT NULL DEFAULT 'pendiente'
    CHECK (estado_cliente IN ('pendiente','aceptada','rechazada')),
  ADD COLUMN IF NOT EXISTS aceptada_at timestamptz,
  ADD COLUMN IF NOT EXISTS rechazada_at timestamptz,
  ADD COLUMN IF NOT EXISTS aceptada_por text,
  ADD COLUMN IF NOT EXISTS motivo_rechazo text,
  ADD COLUMN IF NOT EXISTS enviada_at timestamptz,
  ADD COLUMN IF NOT EXISTS enviada_por uuid,
  ADD COLUMN IF NOT EXISTS ultimo_envio_email text;

-- 2) proforma_envios
CREATE TABLE IF NOT EXISTS public.proforma_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id uuid NOT NULL REFERENCES public.proformas(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  enviado_por uuid,
  destinatarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  cc jsonb NOT NULL DEFAULT '[]'::jsonb,
  asunto text,
  mensaje text,
  pdf_storage_path text,
  pdf_link_publico text,
  estado text NOT NULL DEFAULT 'enviado',
  error text,
  snapshot_totales jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proforma_envios_proforma ON public.proforma_envios (proforma_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proforma_envios_org ON public.proforma_envios (organization_id, created_at DESC);

GRANT SELECT, INSERT ON public.proforma_envios TO authenticated;
GRANT ALL ON public.proforma_envios TO service_role;
ALTER TABLE public.proforma_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant read proforma_envios" ON public.proforma_envios;
CREATE POLICY "Tenant read proforma_envios" ON public.proforma_envios FOR SELECT TO authenticated
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant insert proforma_envios" ON public.proforma_envios;
CREATE POLICY "Tenant insert proforma_envios" ON public.proforma_envios FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()));

-- 3) portal_responder_proforma
CREATE OR REPLACE FUNCTION public.portal_responder_proforma(
  p_proforma_id uuid, p_respuesta text, p_motivo text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_proforma public.proformas%ROWTYPE;
  v_user_email text;
  v_now timestamptz := now();
  v_motivo text;
  v_titulo text; v_mensaje text; v_tipo text;
BEGIN
  IF p_respuesta NOT IN ('aceptada','rechazada') THEN
    RAISE EXCEPTION 'Respuesta inválida. Debe ser aceptada o rechazada.';
  END IF;

  SELECT * INTO v_proforma FROM public.proformas
   WHERE id = p_proforma_id AND cliente_id IN (SELECT current_user_client_ids());
  IF NOT FOUND THEN RAISE EXCEPTION 'Proforma no encontrada o no tienes acceso.'; END IF;

  IF v_proforma.estado_cliente <> 'pendiente' THEN
    RAISE EXCEPTION 'Esta proforma ya fue respondida (estado: %).', v_proforma.estado_cliente;
  END IF;

  v_motivo := NULLIF(trim(p_motivo), '');
  IF p_respuesta = 'rechazada' AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Es obligatorio indicar el motivo de rechazo.';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  UPDATE public.proformas
     SET estado_cliente = p_respuesta,
         aceptada_at    = CASE WHEN p_respuesta='aceptada'  THEN v_now ELSE aceptada_at END,
         rechazada_at   = CASE WHEN p_respuesta='rechazada' THEN v_now ELSE rechazada_at END,
         aceptada_por   = CASE WHEN p_respuesta='aceptada'  THEN COALESCE(v_user_email, auth.uid()::text) ELSE aceptada_por END,
         motivo_rechazo = CASE WHEN p_respuesta='rechazada' THEN v_motivo ELSE motivo_rechazo END,
         updated_at = v_now
   WHERE id = p_proforma_id;

  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_proforma.organization_id, auth.uid(), COALESCE(v_user_email,''),
          CASE WHEN p_respuesta='aceptada' THEN 'proforma_aceptada_cliente' ELSE 'proforma_rechazada_cliente' END,
          'proformas', p_proforma_id, COALESCE(v_proforma.numero,''),
          jsonb_build_object('proforma_id', p_proforma_id, 'numero', v_proforma.numero,
                             'cliente_id', v_proforma.cliente_id, 'cliente_nombre', v_proforma.cliente_nombre,
                             'respuesta', p_respuesta, 'motivo', v_motivo, 'origen','portal_cliente'));

  v_tipo := CASE WHEN p_respuesta='aceptada' THEN 'proforma_aceptada' ELSE 'proforma_rechazada' END;
  v_titulo := 'Proforma ' || COALESCE(v_proforma.numero,'') || ' ' ||
              CASE WHEN p_respuesta='aceptada' THEN 'aceptada por el cliente' ELSE 'rechazada por el cliente' END;
  v_mensaje := 'Cliente: ' || COALESCE(v_proforma.cliente_nombre,'N/D') ||
               CASE WHEN v_motivo IS NOT NULL THEN E'\nMotivo: ' || v_motivo ELSE '' END;

  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT v_proforma.organization_id, om.user_id, v_tipo, v_titulo, v_mensaje,
         '/proformas/' || p_proforma_id::text, 'proforma', p_proforma_id
    FROM public.organization_members om
   WHERE om.organization_id = v_proforma.organization_id
     AND om.role IN ('admin'::app_role, 'admin_org'::app_role, 'operador'::app_role, 'contador'::app_role);

  RETURN jsonb_build_object('id', p_proforma_id, 'estado_cliente', p_respuesta, 'respondida_at', v_now);
END $$;

REVOKE ALL ON FUNCTION public.portal_responder_proforma(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_responder_proforma(uuid, text, text) TO authenticated;

-- 4) actualizar_estado_cliente_proforma (fallback manual)
CREATE OR REPLACE FUNCTION public.actualizar_estado_cliente_proforma(
  p_proforma_id uuid, p_respuesta text, p_motivo text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_proforma public.proformas%ROWTYPE;
  v_user_email text;
  v_now timestamptz := now();
  v_motivo text;
  v_is_authorized boolean;
BEGIN
  IF p_respuesta NOT IN ('aceptada','rechazada','pendiente') THEN
    RAISE EXCEPTION 'Respuesta inválida.';
  END IF;

  SELECT * INTO v_proforma FROM public.proformas WHERE id = p_proforma_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proforma no encontrada.'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
     WHERE om.user_id = auth.uid()
       AND om.organization_id = v_proforma.organization_id
       AND om.role IN ('admin'::app_role, 'admin_org'::app_role, 'contador'::app_role, 'operador'::app_role)
  ) OR public.has_role(auth.uid(), 'super_admin'::app_role) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'No tienes permisos para cambiar el estado del cliente en esta proforma.';
  END IF;

  v_motivo := NULLIF(trim(p_motivo), '');
  IF p_respuesta = 'rechazada' AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Es obligatorio indicar el motivo de rechazo.';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  UPDATE public.proformas
     SET estado_cliente = p_respuesta,
         aceptada_at    = CASE WHEN p_respuesta='aceptada' THEN v_now
                               WHEN p_respuesta='pendiente' THEN NULL
                               ELSE aceptada_at END,
         rechazada_at   = CASE WHEN p_respuesta='rechazada' THEN v_now
                               WHEN p_respuesta='pendiente' THEN NULL
                               ELSE rechazada_at END,
         aceptada_por   = CASE WHEN p_respuesta='aceptada'
                                 THEN 'manual:' || COALESCE(v_user_email, auth.uid()::text)
                               WHEN p_respuesta='pendiente' THEN NULL
                               ELSE aceptada_por END,
         motivo_rechazo = CASE WHEN p_respuesta='rechazada' THEN v_motivo
                               WHEN p_respuesta='pendiente' THEN NULL
                               ELSE motivo_rechazo END,
         updated_at     = v_now
   WHERE id = p_proforma_id;

  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_proforma.organization_id, auth.uid(), COALESCE(v_user_email,''),
          'proforma_estado_cliente_manual', 'proformas', p_proforma_id, COALESCE(v_proforma.numero,''),
          jsonb_build_object('proforma_id', p_proforma_id,
                             'estado_anterior', v_proforma.estado_cliente,
                             'estado_nuevo', p_respuesta, 'motivo', v_motivo,
                             'origen','manual_interno'));

  RETURN jsonb_build_object('id', p_proforma_id, 'estado_cliente', p_respuesta, 'at', v_now);
END $$;

REVOKE ALL ON FUNCTION public.actualizar_estado_cliente_proforma(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actualizar_estado_cliente_proforma(uuid, text, text) TO authenticated;

-- 5) Trigger de bloqueo: no permitir marcar proforma como facturada si estado_cliente <> 'aceptada'
CREATE OR REPLACE FUNCTION public.enforce_proforma_aceptada_before_factura()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF (OLD.factura_id IS NULL AND NEW.factura_id IS NOT NULL)
     OR (COALESCE(OLD.estado_proforma,'') <> 'facturada' AND NEW.estado_proforma = 'facturada') THEN
    IF COALESCE(NEW.estado_cliente,'pendiente') <> 'aceptada' THEN
      RAISE EXCEPTION 'La proforma % no puede facturarse: el cliente no la ha aceptado (estado actual: %).',
        NEW.numero, COALESCE(NEW.estado_cliente,'pendiente');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_proforma_aceptada ON public.proformas;
CREATE TRIGGER trg_enforce_proforma_aceptada
  BEFORE UPDATE ON public.proformas
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_proforma_aceptada_before_factura();
