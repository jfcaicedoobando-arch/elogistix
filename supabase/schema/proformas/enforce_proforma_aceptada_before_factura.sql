-- Candidato forward 20261011180000; CREATE OR REPLACE conserva ACL.
CREATE OR REPLACE FUNCTION public.enforce_proforma_aceptada_before_factura() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Terminal sólo para acciones; conserva notas, papelera e histórico.
  IF OLD.estado_proforma = 'cancelada' AND (
      NEW.estado_proforma IS DISTINCT FROM OLD.estado_proforma
      OR NEW.estado_cliente IS DISTINCT FROM OLD.estado_cliente
      OR NEW.estado_revision IS DISTINCT FROM OLD.estado_revision
      OR NEW.estado_aprobacion IS DISTINCT FROM OLD.estado_aprobacion
      OR NEW.factura_id IS DISTINCT FROM OLD.factura_id
      OR NEW.factura_secundaria_id IS DISTINCT FROM OLD.factura_secundaria_id
      OR NEW.folio_factura_externa IS DISTINCT FROM OLD.folio_factura_externa
      OR NEW.fecha_facturacion IS DISTINCT FROM OLD.fecha_facturacion
      OR NEW.aceptada_at IS DISTINCT FROM OLD.aceptada_at
      OR NEW.rechazada_at IS DISTINCT FROM OLD.rechazada_at
      OR NEW.aceptada_por IS DISTINCT FROM OLD.aceptada_por
      OR NEW.motivo_rechazo IS DISTINCT FROM OLD.motivo_rechazo
      OR NEW.token_publico IS DISTINCT FROM OLD.token_publico
      OR NEW.token_expira_at IS DISTINCT FROM OLD.token_expira_at
      OR NEW.enviada_at IS DISTINCT FROM OLD.enviada_at
      OR NEW.enviada_por IS DISTINCT FROM OLD.enviada_por
      OR NEW.ultimo_envio_email IS DISTINCT FROM OLD.ultimo_envio_email
      OR NEW.consolidada_en IS DISTINCT FROM OLD.consolidada_en
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: no se puede reactivar el histórico cancelado' USING ERRCODE='P0001';
  END IF;
  IF (OLD.factura_id IS NULL AND NEW.factura_id IS NOT NULL)
     OR (COALESCE(OLD.estado_proforma,'') <> 'facturada' AND NEW.estado_proforma = 'facturada') THEN
    IF COALESCE(NEW.estado_cliente,'pendiente') <> 'aceptada' THEN
      RAISE EXCEPTION 'La proforma % no puede facturarse: el cliente no la ha aceptado (estado actual: %).',
        NEW.numero, COALESCE(NEW.estado_cliente,'pendiente');
    END IF;
  END IF;
  RETURN NEW;
END $$;
