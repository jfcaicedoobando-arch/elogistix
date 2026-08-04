-- R7-FIX5: notificaciones_cliente por MEMBRESÍA de organización (no whitelist de roles)
DROP POLICY IF EXISTS "Tenant staff inserta notificaciones" ON public.notificaciones_cliente;
CREATE POLICY "Tenant staff inserta notificaciones"
ON public.notificaciones_cliente
FOR INSERT
TO authenticated
WITH CHECK (
  has_role((SELECT auth.uid()), 'super_admin'::app_role)
  OR organization_id IN (
    SELECT m.organization_id FROM public.organization_members m
    WHERE m.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Tenant staff lee notificaciones" ON public.notificaciones_cliente;
CREATE POLICY "Tenant staff lee notificaciones"
ON public.notificaciones_cliente
FOR SELECT
TO authenticated
USING (
  has_role((SELECT auth.uid()), 'super_admin'::app_role)
  OR organization_id IN (
    SELECT m.organization_id FROM public.organization_members m
    WHERE m.user_id = (SELECT auth.uid())
  )
);

-- Trigger SECURITY DEFINER: la notificación no depende del cliente JS ni de RLS.
CREATE OR REPLACE FUNCTION public.trg_notificar_cotizacion_enviada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ruta text;
  v_detalles text;
BEGIN
  IF NEW.estado = 'Enviada'::estado_cotizacion
     AND (OLD.estado IS DISTINCT FROM 'Enviada'::estado_cotizacion)
     AND NEW.cliente_id IS NOT NULL
     AND NEW.organization_id IS NOT NULL THEN
    v_ruta := nullif(concat_ws(' → ', nullif(NEW.origen, ''), nullif(NEW.destino, '')), '');
    v_detalles := nullif(concat_ws(' · ', v_ruta, nullif(NEW.tipo::text, '')), '');
    IF NOT EXISTS (
      SELECT 1 FROM public.notificaciones_cliente n
      WHERE n.cliente_id = NEW.cliente_id
        AND n.tipo = 'cotizacion_enviada'
        AND n.url = '/portal/cotizaciones/' || NEW.id
    ) THEN
      INSERT INTO public.notificaciones_cliente
        (cliente_id, organization_id, tipo, titulo, mensaje, url)
      VALUES (
        NEW.cliente_id, NEW.organization_id, 'cotizacion_enviada',
        trim('Nueva cotización enviada ' || coalesce(NEW.folio, '')),
        coalesce(v_detalles || '. ', '') || 'Tienes una nueva cotización lista para revisar.',
        '/portal/cotizaciones/' || NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_notificar_cotizacion_enviada() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS notificar_cotizacion_enviada ON public.cotizaciones;
CREATE TRIGGER notificar_cotizacion_enviada
AFTER UPDATE OF estado ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public.trg_notificar_cotizacion_enviada();