-- Corrección funcional prospectiva: no reescribe historial ni recalcula filas existentes.
-- Aplicar después de la reemisión H6 idéntica de infraestructura.
-- Conserva ACL existentes. El ajuste de EXECUTE es un cambio separado pendiente.
CREATE OR REPLACE FUNCTION public.recompute_embarque_tiene_proforma(p_embarque_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET "app.bypass_cierre" TO 'on'
    AS $$
DECLARE
  v_tiene_proforma boolean;
BEGIN
  IF p_embarque_id IS NULL THEN RETURN; END IF;
  -- Serializar antes de leer los hijos. En READ COMMITTED, la siguiente
  -- sentencia toma un snapshot nuevo después de esperar al último escritor.
  -- NO KEY UPDATE es compatible con los KEY SHARE de las claves foráneas.
  PERFORM 1 FROM public.embarques WHERE id = p_embarque_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.proformas p
    WHERE p.embarque_id = p_embarque_id
      AND p.deleted_at IS NULL
      AND COALESCE(p.estado_proforma, 'pendiente') <> 'cancelada'
      AND COALESCE(p.estado_cliente, 'pendiente') <> 'rechazada'
      AND COALESCE(p.estado_revision, 'aprobada') <> 'consolidada'
      AND p.consolidada_en IS NULL
      AND (
        p.estado_proforma = 'facturada'
        OR COALESCE(p.estado_aprobacion, 'aprobada') <> 'borrador'
        OR EXISTS (
          SELECT 1 FROM public.conceptos_venta cv
          WHERE cv.proforma_id = p.id AND cv.deleted_at IS NULL
        )
      )
  ) INTO v_tiene_proforma;
  -- Un cambio de metadatos de la proforma no altera updated_at del embarque.
  UPDATE public.embarques SET tiene_proforma = v_tiene_proforma
  WHERE id = p_embarque_id AND tiene_proforma IS DISTINCT FROM v_tiene_proforma;
  -- El SET de la función restaura el valor previo también ante excepciones.
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_embarque_tiene_proforma() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ids uuid[];
  v_embarque uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_ids := ARRAY[NEW.embarque_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_ids := ARRAY[OLD.embarque_id];
  ELSE
    IF (OLD.embarque_id, OLD.deleted_at, OLD.estado_proforma,
        OLD.estado_aprobacion, OLD.estado_cliente, OLD.estado_revision, OLD.consolidada_en)
       IS NOT DISTINCT FROM
       (NEW.embarque_id, NEW.deleted_at, NEW.estado_proforma,
        NEW.estado_aprobacion, NEW.estado_cliente, NEW.estado_revision, NEW.consolidada_en) THEN
      RETURN NEW;
    END IF;
    v_ids := ARRAY[OLD.embarque_id, NEW.embarque_id];
  END IF;
  -- La clave de proforma también existe cuando embarque_id es NULL.
  -- Serializa el vínculo con cambios de conceptos antes de resolver el agregado.
  PERFORM pg_advisory_xact_lock(hashtextextended('proforma-operativa:' || COALESCE(NEW.id, OLD.id)::text, 0));
  -- Ambos extremos se bloquean juntos en el mismo orden, incluso al mover.
  PERFORM 1 FROM public.embarques
  WHERE id = ANY(v_ids) ORDER BY id FOR NO KEY UPDATE;
  FOR v_embarque IN SELECT DISTINCT id FROM unnest(v_ids) AS x(id)
    WHERE id IS NOT NULL ORDER BY id
  LOOP
    PERFORM public.recompute_embarque_tiene_proforma(v_embarque);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_embarque_tiene_proforma_from_concepto() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_proformas uuid[];
  v_lock_key bigint;
  v_embarques uuid[];
  v_actuales uuid[];
  v_embarque uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_proformas := ARRAY[NEW.proforma_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_proformas := ARRAY[OLD.proforma_id];
  ELSE
    IF OLD.proforma_id IS NOT DISTINCT FROM NEW.proforma_id
       AND OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at THEN
      RETURN NEW;
    END IF;
    v_proformas := ARRAY[OLD.proforma_id, NEW.proforma_id];
  END IF;
  -- Ordenar las claves bigint reales mantiene el orden incluso ante colisiones
  -- del hash. No tomamos un row lock de proforma después de bloquear conceptos.
  FOR v_lock_key IN
    SELECT DISTINCT hashtextextended('proforma-operativa:' || id::text, 0) AS lock_key
    FROM unnest(v_proformas) AS x(id) WHERE id IS NOT NULL ORDER BY lock_key
  LOOP
    PERFORM pg_advisory_xact_lock(v_lock_key);
  END LOOP;
  SELECT array_agg(DISTINCT embarque_id ORDER BY embarque_id) INTO v_embarques
  FROM public.proformas WHERE id = ANY(v_proformas) AND embarque_id IS NOT NULL;
  PERFORM 1 FROM public.embarques
  WHERE id = ANY(v_embarques) ORDER BY id FOR NO KEY UPDATE;
  -- Si otra transacción movió la proforma mientras esperábamos, no añadir un
  -- bloqueo fuera de orden ni escribir un agregado del embarque equivocado.
  SELECT array_agg(DISTINCT embarque_id ORDER BY embarque_id) INTO v_actuales
  FROM public.proformas WHERE id = ANY(v_proformas) AND embarque_id IS NOT NULL;
  IF v_actuales IS DISTINCT FROM v_embarques THEN
    RAISE EXCEPTION 'LC_PROFORMA_VINCULO_CAMBIO: la proforma cambió de embarque; vuelve a intentar la operación'
      USING ERRCODE = '40001';
  END IF;
  FOREACH v_embarque IN ARRAY COALESCE(v_embarques, ARRAY[]::uuid[]) LOOP
    PERFORM public.recompute_embarque_tiene_proforma(v_embarque);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.liberar_conceptos_de_proforma(p_proforma_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_embarque_id uuid;
  v_liberados   integer := 0;
BEGIN
  SELECT embarque_id INTO v_embarque_id FROM public.proformas WHERE id = p_proforma_id;
  IF v_embarque_id IS NULL THEN
    RETURN 0;
  END IF;
  WITH upd AS (
    UPDATE public.conceptos_venta
       SET proforma_id = NULL,
           estado_facturacion = 'pendiente'
     WHERE proforma_id = p_proforma_id AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_liberados FROM upd;
  -- El cálculo canónico incluye rechazo, cancelación, borradores y consolidación.
  PERFORM public.recompute_embarque_tiene_proforma(v_embarque_id);
  RETURN v_liberados;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_conceptos_venta_facturado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET "app.bypass_cierre" TO 'on'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.conceptos_venta
       SET estado_facturacion = 'pendiente',
           proforma_id = NULL
     WHERE proforma_id = NEW.id
       AND deleted_at IS NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.estado_proforma IS DISTINCT FROM OLD.estado_proforma THEN
    IF NEW.estado_proforma = 'facturada' THEN
      UPDATE public.conceptos_venta
         SET estado_facturacion = 'facturado'
       WHERE proforma_id = NEW.id
         AND deleted_at IS NULL
         AND estado_facturacion <> 'facturado';
    ELSIF NEW.estado_proforma = 'pendiente' AND OLD.estado_proforma = 'facturada' THEN
      UPDATE public.conceptos_venta
         SET estado_facturacion = 'en_proforma'
       WHERE proforma_id = NEW.id
         AND deleted_at IS NULL
         AND estado_facturacion = 'facturado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_proforma_atomica(p_organization_id uuid, p_embarque_id uuid, p_cliente_id uuid, p_cliente_nombre text, p_expediente text, p_bl_master text, p_concepto_ids uuid[], p_subtotal_usd numeric, p_iva_usd numeric, p_total_usd numeric, p_subtotal_mxn numeric, p_iva_mxn numeric, p_total_mxn numeric, p_notas text, p_operador text, p_dias_credito integer, p_tasa_iva numeric, p_iva_overrides jsonb DEFAULT '{}'::jsonb) RETURNS public.proformas
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_numero text;
  v_estado_embarque text;
  v_proforma public.proformas;
  v_override record;
  v_org uuid;
  v_sub_usd numeric := 0;
  v_iva_usd numeric := 0;
  v_sub_mxn numeric := 0;
  v_iva_mxn numeric := 0;
  v_tc numeric;
  v_ocupados int;
  v_actualizados int;
  v_ajenos int;
  v_no_soportados int;
  v_overrides_fuera int;
  -- R170-02: fecha de negocio en hora México, no CURRENT_DATE (UTC).
  v_hoy_mx date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  IF p_concepto_ids IS NULL OR array_length(p_concepto_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar al menos un concepto';
  END IF;
  IF has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org := p_organization_id;
  ELSE
    v_org := current_user_org_id();
  END IF;
  PERFORM public._assert_writer(v_org);
  -- Ola E1 · C5: el embarque debe existir en la organización y coincidir con
  -- el cliente recibido; antes se confiaba en los argumentos del cliente.
  IF NOT EXISTS (
    SELECT 1 FROM public.embarques e
     WHERE e.id = p_embarque_id
       AND e.organization_id = v_org
       AND e.deleted_at IS NULL
       AND (p_cliente_id IS NULL OR e.cliente_id = p_cliente_id)
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_EMBARQUE_INVALIDO: el embarque no existe en tu organización o no corresponde al cliente indicado'
      USING ERRCODE = 'P0001';
  END IF;
  -- El cierre operativo no se elude por un efecto lateral del trigger
  -- que mantiene tiene_proforma. Los guards vuelven a validar al vincular.
  SELECT estado::text INTO v_estado_embarque FROM public.embarques
  WHERE id = p_embarque_id AND organization_id = v_org FOR KEY SHARE;
  IF v_estado_embarque = 'Cerrado' THEN
    RAISE EXCEPTION 'LC_EMBARQUE_CERRADO: reabre el embarque antes de generar una proforma'
      USING ERRCODE = '23514';
  END IF;
  -- Bloquea los conceptos y valida que estén libres antes de crear la proforma.
  PERFORM 1 FROM public.conceptos_venta
   WHERE id = ANY(p_concepto_ids) AND organization_id = v_org
   ORDER BY id FOR UPDATE;
  -- Ola E1 · C5: ningún concepto puede venir de otro embarque ni estar borrado.
  SELECT COUNT(*) INTO v_ajenos
  FROM unnest(p_concepto_ids) AS s(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.conceptos_venta cv
     WHERE cv.id = s.id
       AND cv.organization_id = v_org
       AND cv.embarque_id = p_embarque_id
       AND cv.deleted_at IS NULL
  );
  IF v_ajenos > 0 THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_AJENOS: % concepto(s) no pertenecen a este embarque o fueron eliminados; recarga la pantalla', v_ajenos
      USING ERRCODE = 'P0001';
  END IF;
  -- Ola 2 · A: EUR (o cualquier moneda fuera de MXN/USD) no es soportado en
  -- venta; antes se proformaba y facturaba en $0 en silencio.
  SELECT COUNT(*) INTO v_no_soportados
  FROM public.conceptos_venta
  WHERE id = ANY(p_concepto_ids)
    AND organization_id = v_org
    AND moneda NOT IN ('MXN', 'USD');
  IF v_no_soportados > 0 THEN
    RAISE EXCEPTION 'LC_MONEDA_VENTA_NO_SOPORTADA: % concepto(s) de venta tienen una moneda no soportada; sólo se puede facturar en MXN o USD', v_no_soportados
      USING ERRCODE = 'P0001';
  END IF;
  SELECT COUNT(*) INTO v_ocupados
  FROM public.conceptos_venta
  WHERE id = ANY(p_concepto_ids)
    AND organization_id = v_org
    AND (proforma_id IS NOT NULL OR COALESCE(estado_facturacion, 'pendiente') <> 'pendiente');
  IF v_ocupados > 0 THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_YA_ASIGNADOS: % concepto(s) ya están en otra proforma o facturados; recarga la pantalla', v_ocupados
      USING ERRCODE = 'P0001';
  END IF;
  IF p_iva_overrides IS NOT NULL AND p_iva_overrides <> '{}'::jsonb THEN
    -- Integridad: un override sólo puede tocar conceptos de ESTA selección.
    -- Antes, el UPDATE no filtraba por p_concepto_ids y podía cambiar
    -- aplica_iva de cualquier otro concepto del mismo embarque.
    SELECT COUNT(*) INTO v_overrides_fuera
    FROM jsonb_object_keys(p_iva_overrides) AS k(id)
    WHERE NOT (k.id::uuid = ANY(p_concepto_ids));
    IF v_overrides_fuera > 0 THEN
      RAISE EXCEPTION 'LC_OVERRIDE_FUERA_DE_SELECCION: % ajuste(s) de IVA apuntan a conceptos que no están en esta proforma; recarga la pantalla', v_overrides_fuera
        USING ERRCODE = 'P0001';
    END IF;
    FOR v_override IN
      SELECT key AS concepto_id, (value)::text::boolean AS aplica
      FROM jsonb_each(p_iva_overrides)
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.conceptos_venta cv
        WHERE cv.id = v_override.concepto_id::uuid AND cv.organization_id = v_org
          AND v_override.aplica IS DISTINCT FROM (public._tasa_iva_canonica(cv.tipo_iva, cv.tasa_iva_aplicada, cv.aplica_iva) > 0)
      ) THEN
        RAISE EXCEPTION 'LC_PROFORMA_IVA_OVERRIDE: el IVA no se cambia al generar; clasifica explícitamente el concepto de venta'
          USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END IF;
  PERFORM public._assert_iva_proforma_coherente(tipo_iva, tasa_iva_aplicada, aplica_iva)
  FROM public.conceptos_venta WHERE id = ANY(p_concepto_ids) AND organization_id = v_org;
  SELECT
    COALESCE(SUM(CASE WHEN moneda='USD' THEN ROUND(cantidad*precio_unitario, 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='USD'
                      THEN ROUND(ROUND(cantidad*precio_unitario, 2) * public._tasa_iva_canonica(tipo_iva, tasa_iva_aplicada, aplica_iva), 2)
                      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='MXN' THEN ROUND(cantidad*precio_unitario, 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='MXN'
                      THEN ROUND(ROUND(cantidad*precio_unitario, 2) * public._tasa_iva_canonica(tipo_iva, tasa_iva_aplicada, aplica_iva), 2)
                      ELSE 0 END), 0)
  INTO v_sub_usd, v_iva_usd, v_sub_mxn, v_iva_mxn
  FROM public.conceptos_venta
  WHERE id = ANY(p_concepto_ids) AND organization_id = v_org;
  IF v_sub_usd > 0 THEN
    SELECT tipo_cambio_usd INTO v_tc
    FROM public.embarques
    WHERE id = p_embarque_id AND organization_id = v_org;
    IF v_tc IS NULL OR v_tc <= 0 THEN
      RAISE EXCEPTION 'LC_PROFORMA_TC_REQUERIDO: el embarque no tiene tipo de cambio USD para convertir los conceptos en dólares'
        USING ERRCODE='P0001';
    END IF;
    v_sub_mxn := v_sub_mxn + round(v_sub_usd * v_tc, 2);
    v_iva_mxn := v_iva_mxn + round(v_iva_usd * v_tc, 2);
  END IF;
  IF ABS(COALESCE(p_iva_usd,0) - v_iva_usd) > 0.01
     OR ABS(COALESCE(p_iva_mxn,0) - v_iva_mxn) > 0.01 THEN
    RAISE NOTICE 'crear_proforma_atomica: desfase cliente vs server';
  END IF;
  v_numero := public.generar_numero_proforma(v_org);
  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id, tasa_iva_aplicada,
    fecha_emision
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    v_sub_usd, v_iva_usd, v_sub_usd + v_iva_usd,
    v_sub_mxn, v_iva_mxn, v_sub_mxn + v_iva_mxn,
    p_notas, p_operador, p_dias_credito, v_org, p_tasa_iva,
    v_hoy_mx
  )
  RETURNING * INTO v_proforma;
  UPDATE public.conceptos_venta
  SET estado_facturacion = 'en_proforma', proforma_id = v_proforma.id
  WHERE id = ANY(p_concepto_ids)
    AND organization_id = v_org
    AND embarque_id = p_embarque_id
    AND proforma_id IS NULL
    AND COALESCE(estado_facturacion, 'pendiente') = 'pendiente';
  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  IF v_actualizados <> array_length(p_concepto_ids, 1) THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_YA_ASIGNADOS: los conceptos cambiaron de estado durante la operación; recarga la pantalla'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN v_proforma;
END;
$_$;

CREATE OR REPLACE FUNCTION public.actualizar_estado_cliente_proforma(p_proforma_id uuid, p_respuesta text, p_motivo text DEFAULT ''::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_proforma      public.proformas%ROWTYPE;
  v_user_email    text;
  v_now           timestamptz := now();
  v_motivo        text;
  v_is_authorized boolean;
  v_bypass_prev text;
  v_liberados     integer := 0;
BEGIN
  IF p_respuesta NOT IN ('aceptada','rechazada','pendiente') THEN
    RAISE EXCEPTION 'Respuesta inválida.';
  END IF;
  SELECT * INTO v_proforma FROM public.proformas WHERE id = p_proforma_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proforma no encontrada.'; END IF;
  IF v_proforma.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta proforma está en la papelera; restáurala antes de cambiar su estado.';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
     WHERE om.user_id = auth.uid()
       AND om.organization_id = v_proforma.organization_id
       AND om.role IN (
         'admin'::app_role,
         'admin_org'::app_role,
         'gerente_operaciones'::app_role,
         'gerente_comercial'::app_role
       )
  ) OR public.has_role(auth.uid(), 'super_admin'::app_role) INTO v_is_authorized;
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'No tienes permisos para cambiar el estado del cliente en esta proforma.';
  END IF;
  v_motivo := NULLIF(trim(p_motivo), '');
  IF p_respuesta = 'rechazada' AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Es obligatorio indicar el motivo de rechazo.';
  END IF;
  IF p_respuesta = 'rechazada' AND v_proforma.estado_proforma = 'facturada' THEN
    RAISE EXCEPTION 'No puedes rechazar una proforma que ya fue facturada.';
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
                               WHEN p_respuesta='rechazada'
                                 THEN 'manual:' || COALESCE(v_user_email, auth.uid()::text)
                               WHEN p_respuesta='pendiente' THEN NULL
                               ELSE aceptada_por END,
         motivo_rechazo = CASE WHEN p_respuesta='rechazada' THEN v_motivo
                               WHEN p_respuesta='pendiente' THEN NULL
                               ELSE motivo_rechazo END,
         updated_at     = v_now
   WHERE id = p_proforma_id;
  IF p_respuesta = 'rechazada' AND v_proforma.estado_cliente <> 'rechazada' THEN
    -- Respuesta validada del cliente: liberar vínculos derivados no abre
    -- la edición del embarque cerrado ni deja una excepción para la llamada siguiente.
    v_bypass_prev := COALESCE(current_setting('app.bypass_cierre', true), '');
    BEGIN
      PERFORM set_config('app.bypass_cierre', 'on', true);
      v_liberados := public.liberar_conceptos_de_proforma(p_proforma_id);
      PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
      RAISE;
    END;
  END IF;
  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_proforma.organization_id, auth.uid(), COALESCE(v_user_email,''),
          'proforma_estado_cliente_manual', 'proformas', p_proforma_id, COALESCE(v_proforma.numero,''),
          jsonb_build_object('proforma_id', p_proforma_id,
                             'estado_anterior', v_proforma.estado_cliente,
                             'estado_nuevo', p_respuesta,
                             'motivo', v_motivo,
                             'conceptos_liberados', v_liberados,
                             'origen','manual_interno'));
  RETURN jsonb_build_object(
    'id', p_proforma_id,
    'estado_cliente', p_respuesta,
    'at', v_now,
    'conceptos_liberados', v_liberados
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_responder_por_token(p_token uuid, p_respuesta text, p_motivo text DEFAULT ''::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_proforma  public.proformas%ROWTYPE;
  v_now       timestamptz := now();
  v_motivo    text;
  v_titulo    text; v_mensaje text; v_tipo text;
  v_bypass_prev text;
  v_liberados integer := 0;
  v_rl        jsonb;
BEGIN
  v_rl := public.check_ratelimit(
    'rpc:portal_responder_por_token:'
      || COALESCE(NULLIF(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), 'sin-ip')
      || ':' || COALESCE(auth.uid()::text, 'anon'),
    60, 10
  );
  IF (v_rl->>'ok') = 'false' THEN
    RAISE EXCEPTION 'Demasiadas solicitudes. Intenta de nuevo en % segundos.', COALESCE(v_rl->>'retry_after', '60')
      USING ERRCODE = 'P0001';
  END IF;
  IF p_respuesta NOT IN ('aceptada','rechazada') THEN
    RAISE EXCEPTION 'Respuesta inválida.';
  END IF;
  -- fix3: FOR UPDATE serializa respuestas concurrentes del mismo token; la
  -- segunda espera el commit de la primera y ve el estado ya respondido.
  SELECT * INTO v_proforma FROM public.proformas WHERE token_publico = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enlace inválido.'; END IF;
  IF v_proforma.token_expira_at IS NOT NULL AND v_proforma.token_expira_at < now() THEN
    RAISE EXCEPTION 'El enlace ha expirado. Solicita uno nuevo a tu ejecutivo.';
  END IF;
  IF v_proforma.estado_cliente <> 'pendiente' THEN
    RAISE EXCEPTION 'Esta proforma ya fue respondida (%).', v_proforma.estado_cliente;
  END IF;
  IF p_respuesta = 'rechazada' AND v_proforma.estado_proforma = 'facturada' THEN
    RAISE EXCEPTION 'No puedes rechazar una proforma que ya fue facturada.';
  END IF;
  -- fix3: motivo acotado a 1000 caracteres (se copia a bitácora,
  -- notificaciones y emails; antes era text sin límite).
  v_motivo := NULLIF(LEFT(btrim(COALESCE(p_motivo, '')), 1000), '');
  IF p_respuesta = 'rechazada' AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Es obligatorio indicar el motivo de rechazo.';
  END IF;
  -- fix3: compare-and-set atómico — si otra respuesta ganó la carrera entre
  -- el SELECT y este UPDATE, 0 filas y se reporta como ya respondida.
  UPDATE public.proformas
     SET estado_cliente = p_respuesta,
         aceptada_at    = CASE WHEN p_respuesta='aceptada'  THEN v_now ELSE aceptada_at END,
         rechazada_at   = CASE WHEN p_respuesta='rechazada' THEN v_now ELSE rechazada_at END,
         aceptada_por   = CASE WHEN p_respuesta='aceptada'  THEN 'cliente_portal_token'
                               WHEN p_respuesta='rechazada' THEN 'cliente_portal_token'
                               ELSE aceptada_por END,
         motivo_rechazo = CASE WHEN p_respuesta='rechazada' THEN v_motivo ELSE motivo_rechazo END,
         updated_at = v_now
   WHERE id = v_proforma.id
     AND estado_cliente = 'pendiente';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta proforma ya fue respondida por otra solicitud concurrente.';
  END IF;
  IF p_respuesta = 'rechazada' THEN
    -- Respuesta validada del cliente: liberar vínculos derivados no abre
    -- la edición del embarque cerrado ni deja una excepción para la llamada siguiente.
    v_bypass_prev := COALESCE(current_setting('app.bypass_cierre', true), '');
    BEGIN
      PERFORM set_config('app.bypass_cierre', 'on', true);
      v_liberados := public.liberar_conceptos_de_proforma(v_proforma.id);
      PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
      RAISE;
    END;
  END IF;
  -- fix3: usuario sentinel en vez de NULL — bitacora_actividad.usuario_id es
  -- NOT NULL (20260301200638). Mismo patrón que otras escrituras de sistema
  -- ('00000000-…', ver 20260717025858).
  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_proforma.organization_id, '00000000-0000-0000-0000-000000000000'::uuid, 'cliente-portal-token',
          CASE WHEN p_respuesta='aceptada' THEN 'proforma_aceptada_cliente' ELSE 'proforma_rechazada_cliente' END,
          'proformas', v_proforma.id, COALESCE(v_proforma.numero,''),
          jsonb_build_object('proforma_id', v_proforma.id, 'numero', v_proforma.numero,
                             'cliente_id', v_proforma.cliente_id, 'cliente_nombre', v_proforma.cliente_nombre,
                             'respuesta', p_respuesta, 'motivo', v_motivo,
                             'conceptos_liberados', v_liberados,
                             'origen','portal_token'));
  v_tipo := CASE WHEN p_respuesta='aceptada' THEN 'proforma_aceptada' ELSE 'proforma_rechazada' END;
  v_titulo := 'Proforma ' || COALESCE(v_proforma.numero,'') || ' ' ||
              CASE WHEN p_respuesta='aceptada' THEN 'aceptada por el cliente' ELSE 'rechazada por el cliente' END;
  v_mensaje := 'Cliente: ' || COALESCE(v_proforma.cliente_nombre,'N/D') ||
               CASE WHEN v_motivo IS NOT NULL THEN E'\nMotivo: ' || v_motivo ELSE '' END ||
               CASE WHEN p_respuesta='rechazada' AND v_liberados > 0
                    THEN E'\nSe liberaron ' || v_liberados || ' concepto(s) para regenerar la proforma.'
                    ELSE '' END;
  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT v_proforma.organization_id, om.user_id, v_tipo, v_titulo, v_mensaje,
         '/proformas/' || v_proforma.id::text, 'proforma', v_proforma.id
    FROM public.organization_members om
   WHERE om.organization_id = v_proforma.organization_id
     AND om.role IN ('admin'::app_role, 'admin_org'::app_role, 'operador'::app_role, 'contador'::app_role);
  RETURN jsonb_build_object(
    'id', v_proforma.id,
    'estado_cliente', p_respuesta,
    'respondida_at', v_now,
    'conceptos_liberados', v_liberados
  );
END $$;

CREATE OR REPLACE FUNCTION public.consolidar_proformas(p_embarque_id uuid, p_cliente_id uuid, p_cliente_nombre text, p_expediente text, p_bl_master text, p_operador text, p_dias_credito integer, p_organization_id uuid, p_proforma_ids uuid[], p_tasa_iva numeric DEFAULT 0.16, p_request_id uuid DEFAULT NULL::uuid) RETURNS public.proformas
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_bypass_prev text;
  v_nueva          public.proformas;
  v_cached         jsonb;
  v_caller_org     uuid;
  v_org_efectiva   uuid;
  v_count          int;
  v_numero         text;
  v_subtotal_usd   numeric := 0;
  v_iva_usd        numeric := 0;
  v_total_usd      numeric := 0;
  v_subtotal_mxn   numeric := 0;
  v_iva_mxn        numeric := 0;
  v_total_mxn      numeric := 0;
  v_no_soportados  int;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'consolidar_proformas');
  IF v_cached IS NOT NULL THEN
    SELECT * INTO v_nueva FROM public.proformas WHERE id = (v_cached->>'id')::uuid;
    IF FOUND THEN RETURN v_nueva; END IF;
  END IF;
  v_caller_org := public.current_user_org_id();
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org_efectiva := p_organization_id;
  ELSE
    v_org_efectiva := v_caller_org;
  END IF;
  PERFORM public._assert_writer(v_org_efectiva);
  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL OR array_length(p_proforma_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Selecciona al menos 2 proformas para consolidar';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND organization_id = v_org_efectiva;
  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o no pertenecen a la organización';
  END IF;
  -- Ola 3: la consolidación no puede cruzar embarques.
  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids)
      AND embarque_id IS DISTINCT FROM p_embarque_id
  ) THEN
    RAISE EXCEPTION
      'LC_PROFORMA_EMBARQUE_AJENO: todas las proformas a consolidar deben pertenecer al mismo embarque'
      USING ERRCODE = 'P0001';
  END IF;
  -- Ola 2 · A: guard equivalente al de crear_proforma_atomica sobre los
  -- conceptos subyacentes (una moneda no soportada consolidaba en $0).
  SELECT COUNT(*) INTO v_no_soportados
  FROM public.conceptos_venta cv
  WHERE cv.proforma_id = ANY(p_proforma_ids)
    AND cv.organization_id = v_org_efectiva
    AND cv.deleted_at IS NULL
    AND cv.moneda NOT IN ('MXN', 'USD');
  IF v_no_soportados > 0 THEN
    RAISE EXCEPTION 'LC_MONEDA_VENTA_NO_SOPORTADA: % concepto(s) de venta tienen una moneda no soportada; sólo se puede facturar en MXN o USD', v_no_soportados
      USING ERRCODE = 'P0001';
  END IF;
  v_numero := public.generar_numero_proforma(v_org_efectiva);
  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id,
    estado_revision, es_consolidada, proformas_origen, tasa_iva_aplicada
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    0, 0, 0, 0, 0, 0,
    'Consolidación de ' || array_length(p_proforma_ids, 1) || ' proformas',
    p_operador, p_dias_credito, v_org_efectiva,
    'aprobada', true, p_proforma_ids, p_tasa_iva
  ) RETURNING * INTO v_nueva;
  -- A-1: cantidad SIN ::int (BL-1 permite decimales); IVA por LÍNEA con la tasa
  -- propia de cada concepto y redondeo por línea (BL-12). La tasa efectiva y el
  -- tratamiento fiscal explícito entran al GROUP BY: 'no_objeto', 'exento' y
  -- 'tasa_0' quedan en líneas distintas aunque su IVA sea 0.
  -- P1 · Auditoría IVA: la tasa es CANÓNICA por tratamiento; una tasa numérica
  -- faltante NUNCA se rellena con la tasa general si el tipo dice otra cosa.
  INSERT INTO public.proforma_conceptos_consolidados (
    proforma_id, embarque_id, contenedor, tipo_contenedor,
    descripcion, cantidad, precio_unitario, total, moneda, aplica_iva, iva,
    organization_id, tasa_iva_aplicada, tipo_iva
  )
  SELECT
    v_nueva.id, cv.embarque_id,
    COALESCE(NULLIF(ec.numero_contenedor, ''), NULLIF(e.contenedor, ''), 'Sin contenedor'),
    COALESCE(NULLIF(ec.tipo_contenedor, ''), NULLIF(e.tipo_contenedor, '')),
    cv.descripcion, SUM(cv.cantidad), cv.precio_unitario,
    ROUND(SUM(cv.cantidad * cv.precio_unitario), 2), cv.moneda,
    CASE WHEN cv.tipo_iva IN ('no_objeto', 'exento') THEN false ELSE cv.aplica_iva END,
    ROUND(SUM(cv.cantidad * cv.precio_unitario) * CASE
            WHEN cv.tipo_iva = 'gravado_16' THEN p_tasa_iva
            WHEN cv.tipo_iva = 'gravado_8'  THEN 0.08
            WHEN cv.tipo_iva IN ('tasa_0', 'exento', 'no_objeto') THEN 0
            ELSE COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END)
          END, 2),
    v_org_efectiva,
    CASE WHEN cv.tipo_iva = 'no_objeto' THEN NULL
         ELSE CASE
            WHEN cv.tipo_iva = 'gravado_16' THEN p_tasa_iva
            WHEN cv.tipo_iva = 'gravado_8'  THEN 0.08
            WHEN cv.tipo_iva IN ('tasa_0', 'exento', 'no_objeto') THEN 0
            ELSE COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END)
          END
    END,
    cv.tipo_iva
  FROM public.conceptos_venta cv
  LEFT JOIN public.embarques e ON e.id = cv.embarque_id
  LEFT JOIN public.embarque_contenedores ec ON ec.id = cv.contenedor_id
  WHERE cv.proforma_id = ANY(p_proforma_ids)
    AND cv.organization_id = v_org_efectiva
    AND cv.embarque_id = p_embarque_id
    AND cv.deleted_at IS NULL
  GROUP BY cv.embarque_id,
    COALESCE(NULLIF(ec.numero_contenedor, ''), NULLIF(e.contenedor, ''), 'Sin contenedor'),
    COALESCE(NULLIF(ec.tipo_contenedor, ''), NULLIF(e.tipo_contenedor, '')),
    cv.descripcion, cv.precio_unitario, cv.moneda, cv.aplica_iva, cv.tipo_iva,
    CASE
            WHEN cv.tipo_iva = 'gravado_16' THEN p_tasa_iva
            WHEN cv.tipo_iva = 'gravado_8'  THEN 0.08
            WHEN cv.tipo_iva IN ('tasa_0', 'exento', 'no_objeto') THEN 0
            ELSE COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END)
          END;
  -- Encabezado = Σ del detalle recién generado.
  SELECT
    COALESCE(SUM(pcc.total) FILTER (WHERE pcc.moneda = 'USD'), 0),
    COALESCE(SUM(pcc.iva)   FILTER (WHERE pcc.moneda = 'USD'), 0),
    COALESCE(SUM(pcc.total) FILTER (WHERE pcc.moneda = 'MXN'), 0),
    COALESCE(SUM(pcc.iva)   FILTER (WHERE pcc.moneda = 'MXN'), 0)
  INTO v_subtotal_usd, v_iva_usd, v_subtotal_mxn, v_iva_mxn
  FROM public.proforma_conceptos_consolidados pcc
  WHERE pcc.proforma_id = v_nueva.id;
  v_total_usd := v_subtotal_usd + v_iva_usd;
  v_total_mxn := v_subtotal_mxn + v_iva_mxn;
  UPDATE public.proformas
  SET subtotal_usd = v_subtotal_usd, iva_usd = v_iva_usd, total_usd = v_total_usd,
      subtotal_mxn = v_subtotal_mxn, iva_mxn = v_iva_mxn, total_mxn = v_total_mxn
  WHERE id = v_nueva.id
  RETURNING * INTO v_nueva;
  UPDATE public.proformas
  SET estado_revision = 'consolidada', consolidada_en = v_nueva.id
  WHERE id = ANY(p_proforma_ids);
  -- v13.301.69 FIX BUG 2: repuntar conceptos_venta a la proforma consolidada
  -- para que sync_conceptos_venta_facturado propague al facturar/cancelar.
  v_bypass_prev := COALESCE(current_setting('app.bypass_cierre', true), '');
  BEGIN
    PERFORM set_config('app.bypass_cierre', 'on', true);
    UPDATE public.conceptos_venta
       SET proforma_id = v_nueva.id
     WHERE proforma_id = ANY(p_proforma_ids)
       AND organization_id = v_org_efectiva
       AND deleted_at IS NULL;
    PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
    RAISE;
  END;
  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('id', v_nueva.id));
  RETURN v_nueva;
END;
$_$;

DROP TRIGGER IF EXISTS trg_sync_embarque_tiene_proforma_from_concepto ON public.conceptos_venta;
CREATE TRIGGER trg_sync_embarque_tiene_proforma_from_concepto
AFTER INSERT OR DELETE OR UPDATE OF proforma_id, deleted_at ON public.conceptos_venta
FOR EACH ROW EXECUTE FUNCTION public.sync_embarque_tiene_proforma_from_concepto();

-- Reexpresión de ACL existentes, sin ampliar ni retirar EXECUTE.
REVOKE ALL ON FUNCTION public.recompute_embarque_tiene_proforma(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_embarque_tiene_proforma(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_embarque_tiene_proforma(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.sync_embarque_tiene_proforma() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_embarque_tiene_proforma() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_embarque_tiene_proforma() TO service_role;
REVOKE ALL ON FUNCTION public.sync_embarque_tiene_proforma_from_concepto() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_embarque_tiene_proforma_from_concepto() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_embarque_tiene_proforma_from_concepto() TO service_role;
REVOKE ALL ON FUNCTION public.liberar_conceptos_de_proforma(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.liberar_conceptos_de_proforma(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_conceptos_de_proforma(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.sync_conceptos_venta_facturado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_conceptos_venta_facturado() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_conceptos_venta_facturado() TO service_role;
REVOKE ALL ON FUNCTION public.crear_proforma_atomica(uuid, uuid, uuid, text, text, text, uuid[], numeric, numeric, numeric, numeric, numeric, numeric, text, text, integer, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_proforma_atomica(uuid, uuid, uuid, text, text, text, uuid[], numeric, numeric, numeric, numeric, numeric, numeric, text, text, integer, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_proforma_atomica(uuid, uuid, uuid, text, text, text, uuid[], numeric, numeric, numeric, numeric, numeric, numeric, text, text, integer, numeric, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.actualizar_estado_cliente_proforma(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actualizar_estado_cliente_proforma(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_estado_cliente_proforma(uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.portal_responder_por_token(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_responder_por_token(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_responder_por_token(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.portal_responder_por_token(uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.consolidar_proformas(uuid, uuid, text, text, text, text, integer, uuid, uuid[], numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consolidar_proformas(uuid, uuid, text, text, text, text, integer, uuid, uuid[], numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consolidar_proformas(uuid, uuid, text, text, text, text, integer, uuid, uuid[], numeric, uuid) TO service_role;
