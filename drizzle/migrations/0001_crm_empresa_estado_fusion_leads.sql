ALTER TABLE public.crm_empresas
  ADD COLUMN IF NOT EXISTS estado_crm text NOT NULL DEFAULT 'Lead';

DO $$ BEGIN
  ALTER TABLE public.crm_empresas
    ADD CONSTRAINT crm_empresas_estado_crm_chk CHECK (estado_crm IN ('Lead','Sospechoso','Prospecto','Cliente'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS crm_empresas_org_estado_idx ON public.crm_empresas (organization_id, estado_crm);

UPDATE public.crm_empresas e
   SET estado_crm = CASE
     WHEN e.cliente_id IS NOT NULL OR l.estado::text = 'Convertido' THEN 'Cliente'
     WHEN l.estado::text IN ('Prospecto','Calificado','Pendiente de alta') THEN 'Prospecto'
     ELSE 'Lead' END
  FROM public.crm_leads l
 WHERE l.id = e.lead_origen_id;
UPDATE public.crm_empresas SET estado_crm = 'Cliente' WHERE cliente_id IS NOT NULL AND estado_crm <> 'Cliente';

INSERT INTO public.crm_propiedades (objeto, clave, etiqueta, tipo, orden)
VALUES
  ('empresa','pais','País','texto',100), ('empresa','ciudad','Ciudad','texto',101),
  ('empresa','entidad_federativa','Estado (entidad federativa)','texto',102),
  ('empresa','direccion','Dirección','texto',103), ('empresa','cp','C.P.','texto',104),
  ('empresa','rfc','RFC','texto',105), ('empresa','sitio_web','Sitio web','texto',106),
  ('empresa','sector','Sector','texto',107), ('empresa','anios_establecida','Años establecida','numero',108),
  ('empresa','mercancia','Mercancía','texto',109), ('empresa','origen','Origen','texto',110),
  ('empresa','destino','Destino','texto',111), ('empresa','aduana_puerto','Aduana / puerto','texto',112),
  ('empresa','incoterm','Incoterm','texto',113), ('empresa','frecuencia','Frecuencia','texto',114),
  ('empresa','volumen_descripcion','Volumen (descripción)','texto',115),
  ('empresa','proveedor_actual','Proveedor actual','texto',116),
  ('empresa','dolor_explicito','Dolor explícito','texto',117), ('empresa','consecuencia','Consecuencia','texto',118),
  ('empresa','estatus_icp','Estatus ICP','texto',119), ('empresa','motivo_nutricion','Motivo de nutrición','texto',120),
  ('empresa','fecha_nutricion','Fecha de nutrición','fecha',121), ('empresa','notas','Notas','texto',122)
ON CONFLICT (objeto, clave) DO NOTHING;

INSERT INTO public.crm_valores (organization_id, propiedad_id, registro_id, valor_texto)
SELECT e.organization_id, p.id, e.id, btrim(v.txt)
  FROM public.crm_empresas e
  JOIN public.crm_leads l ON l.id = e.lead_origen_id
  CROSS JOIN LATERAL (VALUES
    ('pais',l.pais),('ciudad',l.ciudad),('entidad_federativa',l.entidad_federativa),('direccion',l.direccion),
    ('cp',l.cp),('rfc',l.rfc),('sitio_web',l.sitio_web),('sector',l.sector),('mercancia',l.mercancia),
    ('origen',l.origen),('destino',l.destino),('aduana_puerto',l.aduana_puerto),('incoterm',l.incoterm),
    ('frecuencia',l.frecuencia),('volumen_descripcion',l.volumen),('proveedor_actual',l.proveedor_actual),
    ('dolor_explicito',l.dolor_explicito),('consecuencia',l.consecuencia),('estatus_icp',l.estatus_icp),
    ('motivo_nutricion',l.motivo_nutricion),('notas',l.notas),('rutas_principales',l.rutas)
  ) AS v(clave, txt)
  JOIN public.crm_propiedades p ON p.objeto = 'empresa' AND p.clave = v.clave
 WHERE e.deleted_at IS NULL AND nullif(btrim(v.txt), '') IS NOT NULL
ON CONFLICT (propiedad_id, registro_id) DO NOTHING;

INSERT INTO public.crm_valores (organization_id, propiedad_id, registro_id, valor_numero)
SELECT e.organization_id, p.id, e.id, l.anios_establecida
  FROM public.crm_empresas e JOIN public.crm_leads l ON l.id = e.lead_origen_id
  JOIN public.crm_propiedades p ON p.objeto = 'empresa' AND p.clave = 'anios_establecida'
 WHERE e.deleted_at IS NULL AND l.anios_establecida IS NOT NULL
ON CONFLICT (propiedad_id, registro_id) DO NOTHING;

INSERT INTO public.crm_valores (organization_id, propiedad_id, registro_id, valor_fecha)
SELECT e.organization_id, p.id, e.id, l.fecha_nutricion
  FROM public.crm_empresas e JOIN public.crm_leads l ON l.id = e.lead_origen_id
  JOIN public.crm_propiedades p ON p.objeto = 'empresa' AND p.clave = 'fecha_nutricion'
 WHERE e.deleted_at IS NULL AND l.fecha_nutricion IS NOT NULL
ON CONFLICT (propiedad_id, registro_id) DO NOTHING;

INSERT INTO public.crm_valores (organization_id, propiedad_id, registro_id, opcion_ids)
SELECT e.organization_id, p.id, e.id, ARRAY[o.id]
  FROM public.crm_empresas e JOIN public.crm_leads l ON l.id = e.lead_origen_id
  JOIN public.crm_propiedades p ON p.objeto = 'empresa' AND p.clave = 'fuente'
  JOIN public.crm_propiedad_opciones o ON o.propiedad_id = p.id AND NOT o.archivada AND o.etiqueta = l.fuente::text
 WHERE e.deleted_at IS NULL
ON CONFLICT (propiedad_id, registro_id) DO NOTHING;

INSERT INTO public.crm_valores (organization_id, propiedad_id, registro_id, opcion_ids)
SELECT e.organization_id, p.id, e.id, array_agg(o.id ORDER BY o.orden)
  FROM public.crm_empresas e JOIN public.crm_leads l ON l.id = e.lead_origen_id
  JOIN public.crm_propiedades p ON p.objeto = 'empresa' AND p.clave = 'tipo_transporte'
  JOIN public.crm_propiedad_opciones o ON o.propiedad_id = p.id AND NOT o.archivada
 WHERE e.deleted_at IS NULL AND (
       (o.etiqueta ILIKE 'Terrestre%' AND l.interes_modo ~* 'terrestre|multimodal')
    OR (o.etiqueta ILIKE 'Mar%' AND l.interes_modo ~* 'mar.tim|fcl|lcl|multimodal')
    OR (o.etiqueta ILIKE 'A%reo%' AND l.interes_modo ~* 'a.re[oa]'))
 GROUP BY e.organization_id, p.id, e.id
ON CONFLICT (propiedad_id, registro_id) DO NOTHING;

INSERT INTO public.crm_valores (organization_id, propiedad_id, registro_id, valor_texto)
SELECT c.organization_id, p.id, c.id, btrim(l.cargo_contacto)
  FROM public.crm_contactos c JOIN public.crm_leads l ON l.id = c.lead_origen_id
  JOIN public.crm_propiedades p ON p.objeto = 'contacto' AND p.clave = 'puesto'
 WHERE c.deleted_at IS NULL AND nullif(btrim(l.cargo_contacto), '') IS NOT NULL
ON CONFLICT (propiedad_id, registro_id) DO NOTHING;

UPDATE public.crm_contactos c
   SET email = coalesce(nullif(btrim(c.email), ''), nullif(lower(btrim(l.email)), '')),
       telefono = coalesce(nullif(btrim(c.telefono), ''), nullif(btrim(l.telefono), ''))
  FROM public.crm_leads l
 WHERE l.id = c.lead_origen_id AND c.deleted_at IS NULL
   AND ((nullif(btrim(c.email), '') IS NULL AND nullif(btrim(l.email), '') IS NOT NULL)
     OR (nullif(btrim(c.telefono), '') IS NULL AND nullif(btrim(l.telefono), '') IS NOT NULL));

CREATE OR REPLACE FUNCTION public._crm_empresa_estado_por_cliente()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL THEN NEW.estado_crm := 'Cliente'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_crm_empresa_estado_por_cliente ON public.crm_empresas;
CREATE TRIGGER trg_crm_empresa_estado_por_cliente
BEFORE INSERT OR UPDATE OF cliente_id ON public.crm_empresas
FOR EACH ROW EXECUTE FUNCTION public._crm_empresa_estado_por_cliente();

CREATE OR REPLACE FUNCTION public._crm_lead_sync_estado_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.crm_empresas e
     SET estado_crm = CASE WHEN NEW.estado::text = 'Convertido' THEN 'Cliente' ELSE 'Prospecto' END
   WHERE e.lead_origen_id = NEW.id AND e.organization_id = NEW.organization_id
     AND e.estado_crm <> 'Cliente'
     AND NEW.estado::text IN ('Prospecto','Calificado','Pendiente de alta','Convertido');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._crm_lead_sync_estado_empresa() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_crm_lead_sync_estado_empresa ON public.crm_leads;
CREATE TRIGGER trg_crm_lead_sync_estado_empresa
AFTER UPDATE OF estado ON public.crm_leads
FOR EACH ROW WHEN (NEW.estado IS DISTINCT FROM OLD.estado)
EXECUTE FUNCTION public._crm_lead_sync_estado_empresa();

CREATE OR REPLACE FUNCTION public.crm_empresa_pasar_a_prospecto(p_empresa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_org uuid := public.org_scope();
  v_emp public.crm_empresas%ROWTYPE;
  v_lead uuid; v_etapa uuid; v_op uuid; v_email text;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'LC_SIN_ORGANIZACION' USING ERRCODE = '42501'; END IF;
  PERFORM public._assert_writer(v_org);
  SELECT * INTO v_emp FROM public.crm_empresas
   WHERE id = p_empresa_id AND organization_id = v_org AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_CRM_EMPRESA_NO_ENCONTRADA' USING ERRCODE = 'P0002'; END IF;

  SELECT o.id INTO v_op FROM public.crm_oportunidad_empresa oe
    JOIN public.crm_oportunidades o ON o.id = oe.oportunidad_id AND o.deleted_at IS NULL
   WHERE oe.empresa_id = v_emp.id ORDER BY o.created_at LIMIT 1;
  IF v_emp.estado_crm NOT IN ('Lead','Sospechoso') AND v_op IS NOT NULL THEN
    RETURN jsonb_build_object('oportunidad_id', v_op, 'sin_cambios', true);
  END IF;

  SELECT id INTO v_etapa FROM public.crm_etapas_pipeline
   WHERE organization_id = v_org AND nombre = 'Prospecto' ORDER BY orden LIMIT 1;
  IF v_etapa IS NULL THEN RAISE EXCEPTION 'LC_CRM_ETAPA_PROSPECTO_FALTANTE'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  v_lead := v_emp.lead_origen_id;
  IF v_lead IS NULL THEN
    INSERT INTO public.crm_leads (organization_id, empresa, estado, vendedor_id, vendedor_email, created_by)
    VALUES (v_org, v_emp.nombre, 'Prospecto', auth.uid(), coalesce(v_email, ''), auth.uid())
    RETURNING id INTO v_lead;
    UPDATE public.crm_empresas SET lead_origen_id = v_lead WHERE id = v_emp.id;
  ELSE
    UPDATE public.crm_leads SET estado = 'Prospecto'
     WHERE id = v_lead AND estado::text IN ('Nuevo','Contactado','Descalificado');
  END IF;

  IF v_op IS NULL THEN
    INSERT INTO public.crm_oportunidades
      (organization_id, nombre, cliente_nombre, lead_id, etapa_id, vendedor_id, vendedor_email, created_by)
    VALUES (v_org, v_emp.nombre, v_emp.nombre, v_lead, v_etapa, auth.uid(), coalesce(v_email, ''), auth.uid())
    RETURNING id INTO v_op;
    INSERT INTO public.crm_oportunidad_empresa (oportunidad_id, empresa_id) VALUES (v_op, v_emp.id);
  END IF;

  UPDATE public.crm_empresas SET estado_crm = 'Prospecto' WHERE id = v_emp.id AND estado_crm IN ('Lead','Sospechoso');
  RETURN jsonb_build_object('oportunidad_id', v_op, 'sin_cambios', false);
END $$;
REVOKE ALL ON FUNCTION public.crm_empresa_pasar_a_prospecto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_empresa_pasar_a_prospecto(uuid) TO authenticated, service_role;

UPDATE public.crm_empresas e SET estado_crm = 'Sospechoso'
  FROM public.crm_oportunidad_empresa oe
  JOIN public.crm_oportunidades o ON o.id = oe.oportunidad_id AND o.deleted_at IS NULL
  JOIN public.crm_etapas_pipeline s ON s.id = o.etapa_id AND s.nombre = 'Sospechoso'
 WHERE oe.empresa_id = e.id AND e.estado_crm <> 'Cliente';
UPDATE public.crm_oportunidades o SET deleted_at = now()
  FROM public.crm_etapas_pipeline s
 WHERE s.id = o.etapa_id AND s.nombre = 'Sospechoso' AND o.deleted_at IS NULL;
UPDATE public.crm_etapas_pipeline SET activa = false, deleted_at = now()
 WHERE nombre = 'Sospechoso' AND deleted_at IS NULL;

UPDATE public.crm_etapas_pipeline SET nombre = 'En cotización'
 WHERE nombre = 'Calificado' AND deleted_at IS NULL;