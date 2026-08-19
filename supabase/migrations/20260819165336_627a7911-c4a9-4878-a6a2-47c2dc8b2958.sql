ALTER TRIGGER trg_pago_factura_viva ON public.pagos_factura
  RENAME TO zz_pago_factura_viva;
ALTER TRIGGER trg_pagos_factura_calc_ret ON public.pagos_factura
  RENAME TO zzz_pagos_factura_calc_ret;