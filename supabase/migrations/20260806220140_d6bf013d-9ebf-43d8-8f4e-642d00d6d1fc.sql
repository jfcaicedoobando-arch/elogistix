CREATE OR REPLACE VIEW public.v_saldos_cuentas_bancarias AS
  SELECT cuenta_bancaria_id,
     COALESCE(sum(abono), 0::numeric) AS total_abonos,
     COALESCE(sum(cargo), 0::numeric) AS total_cargos
    FROM public.bbva_movimientos
   WHERE deleted_at IS NULL
   GROUP BY cuenta_bancaria_id;