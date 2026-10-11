-- Candidato forward 20261011180000; CREATE OR REPLACE conserva ACL.
CREATE OR REPLACE FUNCTION public.tg_facturas_link_proforma() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_estado_proforma text;
BEGIN
  IF NEW.proforma_id IS NOT NULL AND NEW.deleted_at IS NULL
     AND NEW.estado NOT IN ('Cancelada'::estado_factura,'Sustituida'::estado_factura) THEN
    -- Lock de proforma: mismo orden lógico que cancelar/convertir.
    SELECT estado_proforma INTO v_estado_proforma FROM public.proformas
    WHERE id = NEW.proforma_id AND organization_id = NEW.organization_id FOR UPDATE;
    IF v_estado_proforma = 'cancelada' THEN
      IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: no se puede facturar una proforma cancelada' USING ERRCODE='P0001';
      ELSIF NEW.proforma_id IS DISTINCT FROM OLD.proforma_id
         OR OLD.deleted_at IS NOT NULL
         OR OLD.estado IN ('Cancelada'::estado_factura,'Sustituida'::estado_factura) THEN
        RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: no se puede reactivar la factura de una proforma cancelada' USING ERRCODE='P0001';
      END IF;
      IF OLD.estado IN ('Borrador'::estado_factura,'Por timbrar'::estado_factura)
         AND NEW.estado IS DISTINCT FROM OLD.estado THEN
        RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: no se puede emitir un borrador del histórico cancelado' USING ERRCODE='P0001';
      END IF;
      -- Facturas históricas existentes conservan su vínculo sin reactivar proforma.
      RETURN NEW;
    END IF;
    UPDATE public.proformas
       SET factura_id = NEW.id
     WHERE id = NEW.proforma_id
       AND (factura_id IS NULL OR factura_id <> NEW.id)
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
