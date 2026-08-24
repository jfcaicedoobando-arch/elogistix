-- ============================================================================
-- FIX3 · Ronda-2 P3: el trigger de recálculo de comisiones por NC ahora
--          escucha deleted_at y la SALIDA de 'Aplicada'.
-- ============================================================================
-- Hallazgo (bugs2/db_rls_round2.md, P3): trg_nc_cliente_recalcular_comisiones
-- escuchaba sólo UPDATE OF estado, monto y la función retornaba temprano si
-- NEW.estado <> 'Aplicada'. Resultado:
--   (a) un soft-delete (deleted_at := now()) ni siquiera disparaba el trigger;
--   (b) una cancelación Aplicada→Cancelada (permitida por
--       guard_nc_cliente_transicion) caía en la guarda temprana.
-- En ambos casos la NC dejaba de contar en saldo_factura / saldo del pago
-- (el trigger hermano trg_recalcular_estado_factura_nc SÍ escucha deleted_at
-- y recalcula la factura), pero comisiones_devengadas conservaba el
-- denominador viejo y comisiones_recalculo_pendiente no recibía entrada →
-- divergencia duradera factura-vs-comisiones.
--
-- Fix (alineado con el trigger hermano de facturas):
--   · Eventos: AFTER INSERT OR UPDATE OF estado, monto, deleted_at.
--   · La función recalcula/encola cuando la NC "cuenta" ahora (Aplicada y
--     viva) o cuando "contaba" antes y dejó de contar (salió de Aplicada o
--     entró a la papelera). Si ni antes ni ahora cuenta, no hay nada que
--     recalcular (guarda temprana conservada).
-- ============================================================================

CREATE OR REPLACE FUNCTION public._nc_cliente_recalcular_comisiones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago RECORD;
  v_contaba boolean;
  v_cuenta boolean;
BEGIN
  -- FIX3: una NC "cuenta" para comisiones/saldo sólo si está Aplicada y viva.
  v_cuenta  := (NEW.estado::text = 'Aplicada' AND NEW.deleted_at IS NULL);
  v_contaba := (TG_OP = 'UPDATE'
                AND OLD.estado::text = 'Aplicada'
                AND OLD.deleted_at IS NULL);

  -- Ni antes ni ahora cuenta → nada que recalcular (guarda original).
  IF NOT v_cuenta AND NOT v_contaba THEN
    RETURN NEW;
  END IF;

  -- Sigue contando igual (Aplicada→Aplicada, mismo monto, sin papelera) →
  -- nada cambió; evita recálculos espurios en updates no relacionados.
  IF v_cuenta AND v_contaba
     AND COALESCE(OLD.monto, 0) = COALESCE(NEW.monto, 0) THEN
    RETURN NEW;
  END IF;

  FOR v_pago IN
    SELECT pf.id, pf.organization_id,
           EXISTS (
             SELECT 1 FROM public.comisiones_devengadas cd
              WHERE cd.pago_factura_id = pf.id
                AND cd.estado = 'Liquidada'
                AND cd.deleted_at IS NULL
           ) AS ya_liquidada
      FROM public.pagos_factura pf
     WHERE pf.factura_id = NEW.factura_id
       AND pf.deleted_at IS NULL
  LOOP
    IF v_pago.ya_liquidada THEN
      -- La comisión ya se pagó: no se reescribe el histórico, se deja el
      -- ajuste anotado para descontarlo en la siguiente liquidación.
      PERFORM public.registrar_comision_pendiente(
        v_pago.organization_id, v_pago.id, 'ajuste_nc_liquidada',
        CASE WHEN v_cuenta
          THEN 'Nota de crédito aplicada sobre comisión ya liquidada: descontar en la siguiente liquidación'
          ELSE 'Nota de crédito cancelada o en papelera sobre comisión ya liquidada: recalcular el ajuste en la siguiente liquidación'
        END,
        '', '');
    ELSE
      BEGIN
        PERFORM public.calcular_comision_pago(v_pago.id);
      EXCEPTION WHEN OTHERS THEN
        PERFORM public.registrar_comision_pendiente(
          v_pago.organization_id, v_pago.id, 'ajuste_nc',
          'No se pudo recalcular la comisión tras la nota de crédito',
          SQLSTATE, SQLERRM);
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_nc_cliente_recalcular_comisiones ON public.factura_notas_credito;
CREATE TRIGGER trg_nc_cliente_recalcular_comisiones
AFTER INSERT OR UPDATE OF estado, monto, deleted_at ON public.factura_notas_credito
FOR EACH ROW EXECUTE FUNCTION public._nc_cliente_recalcular_comisiones();
