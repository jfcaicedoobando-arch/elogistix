-- IVA "No objeto de impuesto" (SAT ObjetoImp = 01)
-- =================================================
-- Migración PREPARADA (no aplicada). Idempotente: se puede correr varias veces.
--
-- Objetivo: que el tratamiento fiscal "no objeto" viaje explícito del catálogo
-- de productos y servicios a la cotización, la proforma y el CFDI, sin
-- confundirse con "Exento" ni con "Tasa 0%".
--
-- Reglas:
--  · `tipo_iva = 'no_objeto'` ⇒ la tasa se guarda NULL (no hay traslado).
--  · Los registros legacy NO se tocan: sin `tipo_iva` se sigue resolviendo por
--    `aplica_iva` + `tasa_iva_aplicada`.
--  · `_tipo_iva_desde_tasa` JAMÁS devuelve 'no_objeto' (no es inferible).

BEGIN;

-- 1) Catálogo maestro de productos y servicios ------------------------------
ALTER TABLE public.catalogo_claves_sat
  DROP CONSTRAINT IF EXISTS catalogo_claves_sat_tipo_iva_chk;
ALTER TABLE public.catalogo_claves_sat
  ADD CONSTRAINT catalogo_claves_sat_tipo_iva_chk
  CHECK (tipo_iva = ANY (ARRAY['gravado_16','gravado_8','tasa_0','exento','no_objeto']));

-- No objeto y exento no llevan tasa de traslado.
ALTER TABLE public.catalogo_claves_sat
  DROP CONSTRAINT IF EXISTS catalogo_claves_sat_tasa_no_objeto_chk;
ALTER TABLE public.catalogo_claves_sat
  ADD CONSTRAINT catalogo_claves_sat_tasa_no_objeto_chk
  CHECK (tipo_iva <> 'no_objeto' OR COALESCE(tasa_iva_default, 0) = 0)
  NOT VALID;

-- 2) Conceptos de factura (renglones del CFDI) ------------------------------
ALTER TABLE public.conceptos_factura
  DROP CONSTRAINT IF EXISTS conceptos_factura_tipo_iva_check;
ALTER TABLE public.conceptos_factura
  ADD CONSTRAINT conceptos_factura_tipo_iva_check
  CHECK (tipo_iva = ANY (ARRAY['gravado_16','gravado_8','tasa_0','exento','no_objeto']));

ALTER TABLE public.conceptos_factura
  DROP CONSTRAINT IF EXISTS conceptos_factura_no_objeto_sin_tasa_chk;
ALTER TABLE public.conceptos_factura
  ADD CONSTRAINT conceptos_factura_no_objeto_sin_tasa_chk
  CHECK (tipo_iva <> 'no_objeto' OR tasa_iva_aplicada IS NULL)
  NOT VALID;

-- 3) Tratamiento fiscal explícito en venta y proforma -----------------------
ALTER TABLE public.conceptos_venta
  ADD COLUMN IF NOT EXISTS tipo_iva text;
ALTER TABLE public.conceptos_venta
  DROP CONSTRAINT IF EXISTS conceptos_venta_tipo_iva_chk;
ALTER TABLE public.conceptos_venta
  ADD CONSTRAINT conceptos_venta_tipo_iva_chk
  CHECK (tipo_iva IS NULL OR tipo_iva = ANY (ARRAY['gravado_16','gravado_8','tasa_0','exento','no_objeto']));
COMMENT ON COLUMN public.conceptos_venta.tipo_iva IS
  'Tratamiento fiscal heredado del catálogo. NULL = legacy (resolver por aplica_iva/tasa_iva_aplicada). no_objeto = SAT ObjetoImp 01.';

ALTER TABLE public.proforma_conceptos_consolidados
  ADD COLUMN IF NOT EXISTS tipo_iva text;
ALTER TABLE public.proforma_conceptos_consolidados
  DROP CONSTRAINT IF EXISTS pcc_tipo_iva_chk;
ALTER TABLE public.proforma_conceptos_consolidados
  ADD CONSTRAINT pcc_tipo_iva_chk
  CHECK (tipo_iva IS NULL OR tipo_iva = ANY (ARRAY['gravado_16','gravado_8','tasa_0','exento','no_objeto']));

-- 4) Conversión proforma → factura: respetar el tipo explícito ---------------
CREATE OR REPLACE FUNCTION public._convertir_proformas_insertar_conceptos(p_factura_id uuid, p_proforma_ids uuid[], p_org uuid, p_es_consolidada boolean, p_moneda moneda)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_es_consolidada THEN
    INSERT INTO public.conceptos_factura (
      factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
      tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
    )
    SELECT p_factura_id, pcc.descripcion, pcc.cantidad, pcc.precio_unitario,
           pcc.moneda, pcc.total, p_org,
           COALESCE(public.resolver_clave_sat(p_org, pcc.descripcion), '78101800'),
           -- El tipo explícito manda; 'no_objeto' (SAT 01) no es inferible.
           CASE WHEN pcc.tipo_iva IS NOT NULL THEN pcc.tipo_iva
                ELSE public._tipo_iva_desde_tasa(
                  pcc.aplica_iva,
                  CASE WHEN pcc.aplica_iva = false THEN NULL ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16) END)
           END,
           CASE WHEN pcc.tipo_iva = 'no_objeto' THEN NULL
                WHEN pcc.aplica_iva = false THEN NULL
                ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16) END,
           p.embarque_id, pcc.proforma_id
    FROM public.proforma_conceptos_consolidados pcc
    JOIN public.proformas p ON p.id = pcc.proforma_id
    WHERE pcc.proforma_id = ANY(p_proforma_ids)
      AND pcc.moneda = p_moneda
      AND pcc.deleted_at IS NULL;
  ELSE
    INSERT INTO public.conceptos_factura (
      factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
      tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
    )
    SELECT p_factura_id, cv.descripcion, cv.cantidad, cv.precio_unitario,
           cv.moneda, ROUND(cv.cantidad * cv.precio_unitario, 2), p_org,
           COALESCE(public.resolver_clave_sat(p_org, cv.descripcion), '78101800'),
           CASE WHEN cv.tipo_iva IS NOT NULL THEN cv.tipo_iva
                ELSE public._tipo_iva_desde_tasa(
                  cv.aplica_iva,
                  CASE WHEN cv.aplica_iva = false THEN NULL ELSE COALESCE(cv.tasa_iva_aplicada, 0.16) END)
           END,
           CASE WHEN cv.tipo_iva = 'no_objeto' THEN NULL
                WHEN cv.aplica_iva = false THEN NULL
                ELSE COALESCE(cv.tasa_iva_aplicada, 0.16) END,
           p.embarque_id, cv.proforma_id
    FROM public.conceptos_venta cv
    JOIN public.proformas p ON p.id = cv.proforma_id
    WHERE cv.proforma_id = ANY(p_proforma_ids)
      AND cv.moneda = p_moneda
      AND cv.deleted_at IS NULL;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._convertir_proformas_insertar_conceptos(uuid, uuid[], uuid, boolean, moneda) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._convertir_proformas_insertar_conceptos(uuid, uuid[], uuid, boolean, moneda) TO service_role;

-- 5) Consolidación de proformas: el tratamiento fiscal viaja y NO se fusiona ---
-- Antes se agrupaba por descripción/precio/moneda/aplica_iva/tasa: una línea
-- 'no_objeto' (SAT 01) con tasa 0 se fusionaba con una 'tasa_0' o 'exento' de
-- los mismos atributos y perdía el tratamiento. Ahora `tipo_iva` se selecciona,
-- se guarda y entra al GROUP BY; el IVA se recalcula por tipo.
CREATE OR REPLACE FUNCTION public.consolidar_proformas(p_embarque_id uuid, p_cliente_id uuid, p_cliente_nombre text, p_expediente text, p_bl_master text, p_operador text, p_dias_credito integer, p_organization_id uuid, p_proforma_ids uuid[], p_tasa_iva numeric DEFAULT 0.16, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS proformas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
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
    ROUND(SUM(cv.cantidad * cv.precio_unitario)
          * CASE WHEN cv.tipo_iva IN ('no_objeto', 'exento', 'tasa_0') THEN 0
                 ELSE COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END)
            END, 2),
    v_org_efectiva,
    CASE WHEN cv.tipo_iva = 'no_objeto' THEN NULL
         WHEN cv.tipo_iva IN ('exento', 'tasa_0') THEN 0
         ELSE COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END)
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
    COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END);

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
  PERFORM set_config('app.bypass_cierre', 'on', true);
  UPDATE public.conceptos_venta
     SET proforma_id = v_nueva.id
   WHERE proforma_id = ANY(p_proforma_ids)
     AND organization_id = v_org_efectiva
     AND deleted_at IS NULL;
  PERFORM set_config('app.bypass_cierre', 'off', true);

  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('id', v_nueva.id));
  RETURN v_nueva;
END;
$function$;

REVOKE ALL ON FUNCTION public.consolidar_proformas(uuid, uuid, text, text, text, text, integer, uuid, uuid[], numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consolidar_proformas(uuid, uuid, text, text, text, text, integer, uuid, uuid[], numeric, uuid) TO authenticated, service_role;


-- 6) Ventas de embarques: el tratamiento fiscal se guarda y se copia ----------
-- La pantalla "Ventas de embarques" (conceptos_venta capturados fuera del
-- flujo de cotización) ya envía `tipo_iva` en el payload de los RPC. Aquí se
-- parcha el cuerpo vigente de los RPC para que lo persistan, sin reescribirlos
-- completos (son funciones largas y ajenas a este cambio): se toma la
-- definición viva con pg_get_functiondef y se inserta la columna en los
-- INSERT/UPDATE de conceptos_venta. Idempotente: si la función ya menciona
-- tipo_iva no se toca. Si un ancla no aparece, FALLA fuerte (nunca silencioso).
DO $seccion6$
DECLARE
  v_def text;
  v_new text;
  v_oid oid;
  v_anchor text;
  v_repl text;
  v_fn text;
  v_pares text[][] := ARRAY[
    -- crear_embarque_completo: alta simple.
    ARRAY[
      'crear_embarque_completo',
      E'aplica_iva, tasa_iva_aplicada, organization_id)',
      E'aplica_iva, tasa_iva_aplicada, tipo_iva, organization_id)'
    ],
    ARRAY[
      'crear_embarque_completo',
      E'COALESCE((cv->>\'tasa_iva_aplicada\')::numeric, 0.16),\n            v_org_id);',
      E'COALESCE((cv->>\'tasa_iva_aplicada\')::numeric, 0.16),\n            NULLIF(cv->>\'tipo_iva\', \'\'),\n            v_org_id);'
    ],
    -- actualizar_embarque_completo: alta dentro del merge.
    ARRAY[
      'actualizar_embarque_completo',
      E'        aplica_iva, tasa_iva_aplicada, organization_id\n      ) VALUES (',
      E'        aplica_iva, tasa_iva_aplicada, tipo_iva, organization_id\n      ) VALUES ('
    ],
    ARRAY[
      'actualizar_embarque_completo',
      E'        END,\n        v_org_id\n      )\n      RETURNING id INTO v_new_id;',
      E'        END,\n        NULLIF(cv->>\'tipo_iva\', \'\'),\n        v_org_id\n      )\n      RETURNING id INTO v_new_id;'
    ],
    -- actualizar_embarque_completo: edición del renglón existente. El payload
    -- que omite la llave conserva el valor guardado (fila legacy intacta).
    ARRAY[
      'actualizar_embarque_completo',
      E'        END\n      WHERE id = (cv->>\'id\')::uuid',
      E'        END,\n        tipo_iva = CASE\n          WHEN cv ? \'tipo_iva\' THEN NULLIF(cv->>\'tipo_iva\', \'\')\n          ELSE tipo_iva\n        END\n      WHERE id = (cv->>\'id\')::uuid'
    ],
    -- Replicado cotización → embarque.
    ARRAY[
      '_crear_embarque_replicar_conceptos',
      E'          aplica_iva, tasa_iva_aplicada, total, organization_id\n        )',
      E'          aplica_iva, tasa_iva_aplicada, tipo_iva, total, organization_id\n        )'
    ],
    ARRAY[
      '_crear_embarque_replicar_conceptos',
      E'          v_aplica,\n          v_tasa,\n          v_total, p_org\n        );',
      E'          v_aplica,\n          v_tasa,\n          NULLIF(v_venta->>\'tipo_iva\', \'\'),\n          v_total, p_org\n        );'
    ],
    -- Duplicado de embarque: el tratamiento se copia del origen.
    ARRAY[
      'duplicar_embarque_completo',
      E'      organization_id, contenedor_id, aplica_iva\n    )',
      E'      organization_id, contenedor_id, aplica_iva, tipo_iva\n    )'
    ],
    ARRAY[
      'duplicar_embarque_completo',
      E'      aplica_iva\n    FROM conceptos_venta',
      E'      aplica_iva, tipo_iva\n    FROM conceptos_venta'
    ]
  ];
  i integer;
BEGIN
  FOR i IN 1 .. array_length(v_pares, 1) LOOP
    v_fn := v_pares[i][1];
    v_anchor := v_pares[i][2];
    v_repl := v_pares[i][3];

    SELECT p.oid INTO v_oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_fn
     LIMIT 1;
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'No existe public.%(): revisa la migración antes de aplicarla', v_fn;
    END IF;

    v_def := pg_get_functiondef(v_oid);
    IF position(v_repl in v_def) > 0 THEN
      CONTINUE; -- ya parchada (idempotencia)
    END IF;
    IF position(v_anchor in v_def) = 0 THEN
      RAISE EXCEPTION 'Ancla no encontrada en public.%(): el cuerpo cambió, actualiza esta sección', v_fn;
    END IF;
    v_new := replace(v_def, v_anchor, v_repl);
    EXECUTE v_new;
  END LOOP;
END
$seccion6$;

COMMIT;
