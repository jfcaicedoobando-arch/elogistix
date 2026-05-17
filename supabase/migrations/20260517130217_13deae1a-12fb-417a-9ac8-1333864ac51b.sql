-- Bloque 3.3 — Notificaciones a cliente vía portal.
CREATE TABLE IF NOT EXISTS public.notificaciones_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  cliente_id uuid NOT NULL,
  embarque_id uuid,
  factura_id uuid,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensaje text NOT NULL DEFAULT '',
  url text,
  leida_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_cli_cliente ON public.notificaciones_cliente(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_cli_unread ON public.notificaciones_cliente(cliente_id) WHERE leida_at IS NULL;

ALTER TABLE public.notificaciones_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente lee sus notificaciones"
  ON public.notificaciones_cliente FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'cliente'::app_role)
    AND cliente_id IN (SELECT current_user_client_ids())
  );

CREATE POLICY "Cliente marca leida su notificacion"
  ON public.notificaciones_cliente FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'cliente'::app_role)
    AND cliente_id IN (SELECT current_user_client_ids())
  )
  WITH CHECK (
    has_role(auth.uid(), 'cliente'::app_role)
    AND cliente_id IN (SELECT current_user_client_ids())
  );

CREATE POLICY "Tenant staff lee notificaciones"
  ON public.notificaciones_cliente FOR SELECT TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "Tenant staff inserta notificaciones"
  ON public.notificaciones_cliente FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- Trigger: crear notificación cuando cambia el estado del embarque.
CREATE OR REPLACE FUNCTION public.notif_cli_on_embarque_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.estado IS DISTINCT FROM OLD.estado AND NEW.cliente_id IS NOT NULL THEN
    INSERT INTO public.notificaciones_cliente (organization_id, cliente_id, embarque_id, tipo, titulo, mensaje, url)
    VALUES (
      NEW.organization_id,
      NEW.cliente_id,
      NEW.id,
      'embarque_estado',
      'Tu embarque ' || COALESCE(NEW.expediente, '') || ' está ahora en estado: ' || NEW.estado,
      'El estado de tu embarque cambió de "' || COALESCE(OLD.estado::text, '') || '" a "' || NEW.estado::text || '".',
      '/portal/embarques/' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_cli_embarque_estado ON public.embarques;
CREATE TRIGGER trg_notif_cli_embarque_estado
  AFTER UPDATE OF estado ON public.embarques
  FOR EACH ROW
  EXECUTE FUNCTION public.notif_cli_on_embarque_estado();

-- Función para marcar como leída (segura).
CREATE OR REPLACE FUNCTION public.notificacion_cliente_marcar_leida(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.notificaciones_cliente
  SET leida_at = now()
  WHERE id = p_id
    AND cliente_id IN (SELECT current_user_client_ids())
    AND leida_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.notificaciones_cliente_marcar_todas_leidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.notificaciones_cliente
    SET leida_at = now()
    WHERE cliente_id IN (SELECT current_user_client_ids())
      AND leida_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;