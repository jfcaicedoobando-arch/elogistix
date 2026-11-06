CREATE TABLE public.cotizacion_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  cotizacion_id uuid NOT NULL UNIQUE REFERENCES public.cotizaciones(id) ON DELETE RESTRICT,
  coordinador_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cotizacion_handovers_org_coord_idx ON public.cotizacion_handovers (organization_id, coordinador_id, created_at DESC);
GRANT SELECT ON public.cotizacion_handovers TO authenticated;
GRANT ALL ON public.cotizacion_handovers TO service_role;
ALTER TABLE public.cotizacion_handovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Miembros leen handovers de su org" ON public.cotizacion_handovers
  FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_user_org_id()));

CREATE OR REPLACE FUNCTION public._cotizacion_crear_handover()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_coord uuid;
  v_fk text;
  v_msg text;
BEGIN
  IF NEW.estado IS DISTINCT FROM 'Aceptada' OR OLD.estado = 'Aceptada' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM cotizacion_handovers WHERE cotizacion_id = NEW.id) THEN RETURN NEW; END IF;
  -- Serializa el turno por organización para que dos aceptaciones simultáneas no caigan al mismo coordinador.
  PERFORM pg_advisory_xact_lock(hashtext('handover:' || NEW.organization_id::text));
  SELECT m.user_id INTO v_coord
  FROM organization_members m
  LEFT JOIN LATERAL (
    SELECT max(h.created_at) AS ultima FROM cotizacion_handovers h
    WHERE h.organization_id = m.organization_id AND h.coordinador_id = m.user_id
  ) u ON true
  WHERE m.organization_id = NEW.organization_id AND m.role = 'coordinador_logistico'
  ORDER BY u.ultima NULLS FIRST, m.created_at, m.user_id
  LIMIT 1;

  INSERT INTO cotizacion_handovers (organization_id, cotizacion_id, coordinador_id)
  VALUES (NEW.organization_id, NEW.id, v_coord);

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM crm_oportunidades o JOIN crm_leads l ON l.id = o.lead_id
    WHERE o.id = NEW.oportunidad_id AND l.fuente::text = 'Finkargo') THEN 'Sí' ELSE 'No' END INTO v_fk;

  v_msg := format('Cliente: %s | Cliente FK: %s | %s %s | %s → %s | %s | Contenedor: %s x%s | Peso: %s kg | Vol: %s m3 | Seguro: %s',
    COALESCE(NEW.cliente_nombre, NEW.prospecto_empresa, '—'), v_fk, COALESCE(NEW.modo::text, ''), COALESCE(NEW.incoterm::text, ''),
    COALESCE(NEW.origen, '—'), COALESCE(NEW.destino, '—'), COALESCE(NEW.descripcion_mercancia, '—'),
    COALESCE(NEW.tipo_contenedor, '—'), COALESCE(NEW.num_contenedores::text, '—'),
    COALESCE(NEW.peso_kg::text, '—'), COALESCE(NEW.volumen_m3::text, '—'),
    CASE WHEN NEW.seguro THEN 'Sí' ELSE 'No' END);

  INSERT INTO notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT DISTINCT NEW.organization_id, x.uid, 'handover',
    'Handover ' || COALESCE(NEW.folio, '') || CASE WHEN x.uid = v_coord THEN ' asignado a ti' ELSE '' END,
    v_msg, '/cotizaciones/' || NEW.id, 'cotizacion', NEW.id
  FROM (
    SELECT v_coord AS uid WHERE v_coord IS NOT NULL
    UNION SELECT user_id FROM organization_members WHERE organization_id = NEW.organization_id AND role = 'gerente_operaciones'
  ) x;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._cotizacion_crear_handover() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_cotizacion_crear_handover
AFTER UPDATE OF estado ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public._cotizacion_crear_handover();