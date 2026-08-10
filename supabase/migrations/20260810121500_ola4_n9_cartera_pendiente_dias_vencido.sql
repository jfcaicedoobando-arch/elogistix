-- [drift] Prelude defensivo: en bases reconstruidas desde cero la migración
-- legacy que crea public.cobranza_seguimiento (20260617052908) no aplica, por
-- lo que esta función quedaría sin su tabla de apoyo. Se garantiza aquí de
-- forma idempotente (no cambia nada en bases existentes).
CREATE TABLE IF NOT EXISTS public.cobranza_seguimiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  factura_id uuid NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('recordatorio_email','llamada','promesa_pago','nota','visita')),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  comentario text,
  monto_promesa numeric(14,2),
  fecha_promesa date,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobranza_seguimiento TO authenticated;
GRANT ALL ON public.cobranza_seguimiento TO service_role;
ALTER TABLE public.cobranza_seguimiento ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cobranza_seg_factura ON public.cobranza_seguimiento(factura_id);
CREATE INDEX IF NOT EXISTS idx_cobranza_seg_org_fecha ON public.cobranza_seguimiento(organization_id, fecha DESC);

DO $drift$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cobranza_seguimiento' AND policyname='cobranza_seg_select_org') THEN
    CREATE POLICY "cobranza_seg_select_org" ON public.cobranza_seguimiento FOR SELECT TO authenticated USING (
      organization_id = public.current_user_org_id() AND (
        public.has_role(auth.uid(), 'contador'::app_role)
        OR public.has_role(auth.uid(), 'tesorero'::app_role)
        OR public.has_role(auth.uid(), 'ejecutivo_cobranza'::app_role)
        OR public.has_role(auth.uid(), 'admin_org'::app_role)
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'gerente_operaciones'::app_role)
        OR public.has_role(auth.uid(), 'gerente_visor'::app_role)
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cobranza_seguimiento' AND policyname='cobranza_seg_insert_org') THEN
    CREATE POLICY "cobranza_seg_insert_org" ON public.cobranza_seguimiento FOR INSERT TO authenticated WITH CHECK (
      organization_id = public.current_user_org_id() AND (
        public.has_role(auth.uid(), 'contador'::app_role)
        OR public.has_role(auth.uid(), 'ejecutivo_cobranza'::app_role)
        OR public.has_role(auth.uid(), 'admin_org'::app_role)
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cobranza_seguimiento' AND policyname='cobranza_seg_update_org') THEN
    CREATE POLICY "cobranza_seg_update_org" ON public.cobranza_seguimiento FOR UPDATE TO authenticated USING (
      organization_id = public.current_user_org_id()
      AND (usuario_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin_org'::app_role)
        OR public.has_role(auth.uid(), 'super_admin'::app_role))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cobranza_seguimiento' AND policyname='cobranza_seg_delete_org') THEN
    CREATE POLICY "cobranza_seg_delete_org" ON public.cobranza_seguimiento FOR DELETE TO authenticated USING (
      organization_id = public.current_user_org_id()
      AND (usuario_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin_org'::app_role)
        OR public.has_role(auth.uid(), 'super_admin'::app_role))
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='trg_cobranza_seg_updated_at'
      AND tgrelid = 'public.cobranza_seguimiento'::regclass
  ) THEN
    CREATE TRIGGER trg_cobranza_seg_updated_at
      BEFORE UPDATE ON public.cobranza_seguimiento
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$drift$;

-- Ola 4 · N9: cartera_pendiente con dias_vencido con signo.
--
-- N9 (ALTA): la columna dias_vencido venía truncada con GREATEST(0,…);
--    el dominio (bandejas/domain/aggregates.ts matchesUrgencia) exige la
--    diferencia CON SIGNO (negativo = aún no vence) para los filtros
--    por_vencer (-7..0) y accionable (>= -7). El clamp se conserva sólo en
--    el ORDER BY (el orden de la bandeja no cambia).
--
-- Resto del cuerpo idéntico al vigente en BD (nc_aplicadas sin conversión de
-- moneda: fuera de alcance de este fix).
CREATE OR REPLACE FUNCTION public.cartera_pendiente()
RETURNS TABLE(
  factura_id uuid, numero text, cliente_id uuid, cliente_nombre text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_vencido integer,
  moneda text, total numeric, pagado numeric, saldo numeric,
  ultimo_contacto date, estado text)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH base AS (
    SELECT f.id, f.numero, f.cliente_id, f.embarque_id, f.fecha_emision,
      f.fecha_vencimiento, f.moneda::text AS moneda, f.total,
      f.estado::text AS estado, f.cliente_nombre,
      COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                 WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL),0) AS pagado,
      COALESCE((SELECT SUM(nc.monto) FROM public.factura_notas_credito nc
                 WHERE nc.factura_id=f.id AND nc.estado='Aplicada' AND nc.deleted_at IS NULL),0) AS nc_aplicadas
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
  )
  SELECT b.id, b.numero, b.cliente_id, COALESCE(c.nombre, b.cliente_nombre),
    b.embarque_id, e.expediente,
    b.fecha_emision, b.fecha_vencimiento,
    -- Ola 4 · N9: diferencia CON SIGNO (negativo = aún le quedan días).
    (CURRENT_DATE - b.fecha_vencimiento)::int,
    b.moneda, b.total, b.pagado,
    (b.total - b.pagado - b.nc_aplicadas),
    (SELECT MAX(cs.fecha) FROM public.cobranza_seguimiento cs WHERE cs.factura_id=b.id),
    b.estado
  FROM base b
  LEFT JOIN public.clientes c ON c.id=b.cliente_id
  LEFT JOIN public.embarques e ON e.id=b.embarque_id
  WHERE (b.total - b.pagado - b.nc_aplicadas) > 0.005
  -- El clamp GREATEST(0,…) queda SÓLO para ordenar (más vencidas primero).
  ORDER BY GREATEST(0,(CURRENT_DATE-b.fecha_vencimiento)) DESC, b.fecha_vencimiento ASC
  LIMIT 500;
$function$;
