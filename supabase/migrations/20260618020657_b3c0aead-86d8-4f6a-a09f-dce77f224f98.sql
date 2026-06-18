-- Backfill ELIMP00273 (LCL) — sembrar el contenedor hijo único con los totales
-- reales de la cotización COT-2026-0077. El trigger `sync_embarque_desde_contenedor`
-- se encarga de propagar peso/volumen/piezas al embarque parent.
-- Idempotente: sólo actúa si el registro sigue en ceros.
DO $$
BEGIN
  PERFORM set_config('app.bypass_cierre', 'on', true);

  UPDATE public.embarque_contenedores
     SET peso_kg = 0,
         volumen_m3 = 4.09274,
         piezas = 3,
         tipo_contenedor = COALESCE(NULLIF(tipo_contenedor, ''), 'LCL')
   WHERE id = '76866c80-675d-4b36-81cc-28211c131c88'
     AND embarque_id = 'a006c055-e574-4e98-8738-b4f280c3c908'
     AND peso_kg = 0
     AND volumen_m3 = 0
     AND piezas = 0;
END $$;