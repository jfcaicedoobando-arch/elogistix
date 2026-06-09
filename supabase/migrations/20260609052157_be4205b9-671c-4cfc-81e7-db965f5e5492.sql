ALTER TABLE public.proveedor_facturas
  ADD CONSTRAINT proveedor_facturas_proveedor_id_fkey
  FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id)
  ON DELETE RESTRICT;

NOTIFY pgrst, 'reload schema';