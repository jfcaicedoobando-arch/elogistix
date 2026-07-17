
-- ============================================================================
-- Folio de embarque per-organización.
-- Reemplaza la secuencia global `embarque_consecutivo_seq` por una fila en
-- `public.folio_secuencias` con tipo='embarque' por cada org.
-- Motivo: la secuencia global permitía que folios de otra org (incluido
-- Demo con `DEMO-YYYY-###`) contaminaran realineaciones tipo
-- MAX(regexp_replace(expediente,'\D','','g')).
-- ============================================================================

-- 1) Seed del contador per-org usando SÓLO folios en formato estándar.
INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
SELECT organization_id,
       'embarque',
       COALESCE(MAX(substring(expediente FROM 6)::bigint), 0)
  FROM public.embarques
 WHERE expediente ~ '^EL[A-Z]{3}[0-9]+$'
   AND deleted_at IS NULL
 GROUP BY organization_id
ON CONFLICT (organization_id, tipo) DO UPDATE
   SET ultimo_numero = GREATEST(public.folio_secuencias.ultimo_numero,
                                EXCLUDED.ultimo_numero),
       updated_at    = now();

-- 2) Nueva `generar_expediente(text)` — atómica y per-org.
CREATE OR REPLACE FUNCTION public.generar_expediente(tipo_op text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org       uuid;
  v_prefijo   text;
  v_consec    bigint;
  v_exp       text;
  v_intentos  int := 0;
BEGIN
  v_org := public.current_user_org_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No hay organización activa para generar expediente';
  END IF;

  CASE tipo_op
    WHEN 'Importación' THEN v_prefijo := 'IMP';
    WHEN 'Exportación' THEN v_prefijo := 'EXP';
    WHEN 'Nacional'    THEN v_prefijo := 'NAC';
    ELSE                    v_prefijo := 'GEN';
  END CASE;

  LOOP
    -- Incremento atómico per-(org, tipo). INSERT si no existe la fila.
    INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
    VALUES (v_org, 'embarque', 1)
    ON CONFLICT (organization_id, tipo)
    DO UPDATE SET ultimo_numero = public.folio_secuencias.ultimo_numero + 1,
                  updated_at    = now()
    RETURNING ultimo_numero INTO v_consec;

    v_exp := 'EL' || v_prefijo || lpad(v_consec::text, 5, '0');

    -- Defensa: si por reasignación manual el candidato ya existe EN ESTA ORG,
    -- avanza al siguiente.
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.embarques
       WHERE expediente = v_exp
         AND organization_id = v_org
         AND deleted_at IS NULL
    );

    v_intentos := v_intentos + 1;
    IF v_intentos > 1000 THEN
      RAISE EXCEPTION 'No se pudo generar un expediente único tras 1000 intentos';
    END IF;
  END LOOP;

  RETURN v_exp;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generar_expediente(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.generar_expediente(text)
       TO authenticated, service_role;

-- Overload por enum (delegate).
CREATE OR REPLACE FUNCTION public.generar_expediente(tipo_op public.tipo_operacion)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.generar_expediente(tipo_op::text); $$;

REVOKE EXECUTE ON FUNCTION public.generar_expediente(public.tipo_operacion) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.generar_expediente(public.tipo_operacion)
       TO authenticated, service_role;

-- 3) CHECK constraint suave (NOT VALID → sólo valida nuevos inserts).
ALTER TABLE public.embarques
  DROP CONSTRAINT IF EXISTS embarques_expediente_formato_valido;

ALTER TABLE public.embarques
  ADD CONSTRAINT embarques_expediente_formato_valido
  CHECK (
    expediente IS NULL
    OR expediente ~ '^EL[A-Z]{3}[0-9]+$'
    OR expediente ~ '^DEMO-[0-9]{4}-[0-9]+$'
  ) NOT VALID;

-- 4) Retirar la secuencia global obsoleta.
DROP SEQUENCE IF EXISTS public.embarque_consecutivo_seq;
