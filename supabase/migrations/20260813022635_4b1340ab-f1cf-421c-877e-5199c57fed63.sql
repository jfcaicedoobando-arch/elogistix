-- FIX RUX-01 (re-auditoría v13.544.2): get_tracking_public devolvía TODOS los
-- eventos del embarque en el JSON público, exponiendo eventos internos/semilla/
-- E2E a cualquier persona con el enlace. Se filtra con la misma lista de hitos
-- visibles y marcas internas que filtrarEventosVisiblesCliente
-- (src/features/portal/domain/eventosVisiblesCliente.ts). Cuerpo idéntico al
-- vigente salvo el bloque v_eventos.

CREATE OR REPLACE FUNCTION public.get_tracking_public(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link RECORD;
  v_embarque jsonb;
  v_eventos jsonb;
  v_org jsonb;
  v_rl jsonb;
  v_docs jsonb;
  v_modo text;
  v_estado text;
BEGIN
  v_rl := public.check_ratelimit(
    'rpc:get_tracking_public:'
      || COALESCE(NULLIF(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), 'sin-ip')
      || ':' || COALESCE(auth.uid()::text, 'anon'),
    60, 60
  );
  IF (v_rl->>'ok') = 'false' THEN
    RAISE EXCEPTION 'Demasiadas solicitudes. Intenta de nuevo en % segundos.', COALESCE(v_rl->>'retry_after', '60')
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_link FROM public.tracking_links WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT to_jsonb(e) - 'created_at' - 'updated_at' INTO v_embarque
  FROM (
    SELECT id, expediente, cliente_nombre, modo, tipo, estado, etd, eta,
           puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino,
           ciudad_origen, ciudad_destino, tipo_servicio, tipo_carga,
           naviera, aerolinea, transportista
    FROM public.embarques WHERE id = v_link.embarque_id AND deleted_at IS NULL
  ) e;
  IF v_embarque IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- RUX-01: sólo hitos de negocio y sin marcas internas/semilla/E2E.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'tipo', tipo, 'descripcion', descripcion, 'ubicacion', ubicacion, 'fecha', fecha
  ) ORDER BY fecha DESC), '[]'::jsonb)
  INTO v_eventos
  FROM public.eventos_embarque
  WHERE embarque_id = v_link.embarque_id
    AND tipo::text IN (
      'Zarpe', 'Transbordo', 'Arribo a Puerto', 'Descarga',
      'Despacho Aduanal', 'Liberación', 'En Ruta Terrestre', 'Entrega',
      'Cambio de ETA'
    )
    AND lower(COALESCE(descripcion, '')) NOT LIKE '%[interno]%'
    AND lower(COALESCE(descripcion, '')) NOT LIKE '%harness%'
    AND lower(COALESCE(descripcion, '')) NOT LIKE '%e2e%'
    AND lower(COALESCE(descripcion, '')) NOT LIKE '%seed%'
    AND lower(COALESCE(descripcion, '')) NOT LIKE '%qa-%'
    AND lower(COALESCE(usuario, '')) NOT LIKE '%[interno]%'
    AND lower(COALESCE(usuario, '')) NOT LIKE '%harness%'
    AND lower(COALESCE(usuario, '')) NOT LIKE '%e2e%'
    AND lower(COALESCE(usuario, '')) NOT LIKE '%seed%'
    AND lower(COALESCE(usuario, '')) NOT LIKE '%qa-%';

  -- Avance documental visible al cliente: sólo nombre + si ya se recibió.
  -- Nunca se expone `archivo` ni `notas` (información interna).
  v_modo   := v_embarque->>'modo';
  v_estado := v_embarque->>'estado';

  WITH requeridos AS (
    SELECT unnest(public._docs_requeridos_por_estado(v_modo, v_estado)) AS nombre
  ),
  cargados AS (
    SELECT nombre, estado::text AS estado
    FROM public.documentos_embarque
    WHERE embarque_id = v_link.embarque_id
      AND deleted_at IS NULL
  ),
  unidos AS (
    SELECT COALESCE(r.nombre, c.nombre) AS nombre,
           COALESCE(c.estado, 'Pendiente') AS estado,
           (r.nombre IS NOT NULL) AS requerido
    FROM requeridos r
    FULL OUTER JOIN cargados c ON c.nombre = r.nombre
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nombre', nombre,
    'estado', estado,
    'requerido', requerido,
    'recibido', estado IN ('Recibido', 'Validado')
  ) ORDER BY (estado IN ('Recibido', 'Validado')), nombre), '[]'::jsonb)
  INTO v_docs
  FROM unidos;

  SELECT jsonb_build_object('nombre', nombre, 'logo_url', logo_url) INTO v_org
  FROM public.organizations WHERE id = v_link.organization_id;

  RETURN jsonb_build_object(
    'embarque', v_embarque,
    'eventos', v_eventos,
    'documentos', COALESCE(v_docs, '[]'::jsonb),
    'organizacion', v_org
  );
END;
$function$;

-- Bloque canónico de permisos (FIX-H6-15).
REVOKE ALL ON FUNCTION public.get_tracking_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tracking_public(text) TO anon, authenticated, service_role;