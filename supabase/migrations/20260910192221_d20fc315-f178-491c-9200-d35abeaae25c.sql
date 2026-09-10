-- Limpieza puntual: ajuste fantasma por comparación entre monedas distintas.
-- Reutiliza la función de ajustes con lista vacía: hace el borrado lógico del
-- ajuste previo y quita su puente, sin tocar el costo original ni la factura.
SELECT public.crear_ajustes_factura_proveedor_rpc(
  '70e4b713-153f-4c9e-b908-a238989a914f'::uuid,
  '[]'::jsonb
);