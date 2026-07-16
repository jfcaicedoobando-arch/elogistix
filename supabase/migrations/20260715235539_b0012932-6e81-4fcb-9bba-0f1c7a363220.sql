
-- Batch A: modelar cancellation_status como columna de primera clase.
-- Fuente: FacturApi docs — https://docs.facturapi.io/docs/guides/invoices/cancelaciones/
-- Estados posibles del SAT según FacturApi:
--   none      → No hay solicitud registrada.
--   verifying → SAT recibió la solicitud y la está validando.
--   pending   → Requiere aceptación del receptor.
--   accepted  → Cancelación aceptada.
--   rejected  → El receptor rechazó la cancelación.
--   expired   → El receptor no respondió a tiempo (72 h hábiles).

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS cancellation_status text
    CHECK (cancellation_status IN ('none','verifying','pending','accepted','rejected','expired')),
  ADD COLUMN IF NOT EXISTS cancelacion_solicitada_en timestamptz,
  ADD COLUMN IF NOT EXISTS cancelacion_vence_en timestamptz;

COMMENT ON COLUMN public.facturas.cancellation_status IS
  'Estado del SAT para la solicitud de cancelación (FacturApi cancellation_status). NULL = nunca se solicitó.';
COMMENT ON COLUMN public.facturas.cancelacion_solicitada_en IS
  'Momento en que se envió la solicitud de cancelación al SAT. Se limpia si el SAT rechaza o expira.';
COMMENT ON COLUMN public.facturas.cancelacion_vence_en IS
  'Fecha/hora estimada de vencimiento del plazo de 72 h hábiles (silencio positivo). Sólo válida si cancellation_status IN (pending, verifying).';

-- Índice para el job de reconciliación: buscar facturas con estado no-terminal.
CREATE INDEX IF NOT EXISTS idx_facturas_cancellation_pending
  ON public.facturas (organization_id, cancelacion_solicitada_en)
  WHERE cancellation_status IN ('pending','verifying');

-- Función helper: calcula la fecha de vencimiento del silencio positivo (72 h
-- desde el momento de la solicitud, considerando sólo días hábiles). SAT lo
-- calcula así en el Buzón Tributario. Aquí usamos una aproximación conservadora:
-- 72 h calendario + saltamos sábados/domingos entre inicio y fin.
CREATE OR REPLACE FUNCTION public.calc_cancelacion_vence(p_solicitada timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_fin timestamptz := p_solicitada + interval '72 hours';
  v_curr timestamptz := p_solicitada;
  v_extra_days int := 0;
BEGIN
  -- Aproximación: por cada finde en el rango original + 72 h, sumar 2 días
  WHILE v_curr < v_fin LOOP
    IF EXTRACT(dow FROM v_curr) IN (0, 6) THEN
      v_extra_days := v_extra_days + 1;
    END IF;
    v_curr := v_curr + interval '24 hours';
  END LOOP;
  RETURN v_fin + (v_extra_days || ' hours')::interval;
END;
$$;

COMMENT ON FUNCTION public.calc_cancelacion_vence IS
  'Aproximación de las 72 h hábiles del silencio positivo SAT sumando 24 h por cada día no hábil dentro del rango.';
