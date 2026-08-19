-- El orden de disparo de triggers BEFORE es alfabético por nombre.
-- `tg_pagos_factura_no_sobrepago` corría ANTES de
-- `trg_pagos_factura_monto_convertido`, así que validaba el saldo con el
-- `monto_aplicado_factura` enviado por el cliente y no con el convertido por
-- la BD. Se renombra con prefijo `zz_` para que corra al final.
ALTER TRIGGER tg_pagos_factura_no_sobrepago ON public.pagos_factura
  RENAME TO zz_pagos_factura_no_sobrepago;