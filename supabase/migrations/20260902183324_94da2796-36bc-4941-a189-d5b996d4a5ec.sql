-- No-op: refresca metadatos para regenerar los tipos del cliente.
COMMENT ON FUNCTION public._cuenta_bancaria_guard_baja() IS
  'Guard: impide dar de baja o eliminar una cuenta bancaria con movimientos históricos.';