-- B-9: la validación de "fecha de pago anterior a la emisión" ya la aplica
-- assert_factura_viva_para_pago (LC_PAGO_FECHA_PREVIA_EMISION). El trigger
-- añadido en la Ola 4 era redundante y con otro código de error.
DROP TRIGGER IF EXISTS trg_pago_fecha_no_previa ON public.pagos_factura;
DROP FUNCTION IF EXISTS public._assert_fecha_pago_no_previa();