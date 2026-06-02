ALTER TABLE public.pagos_factura
  ADD CONSTRAINT pagos_factura_factura_id_fkey
  FOREIGN KEY (factura_id) REFERENCES public.facturas(id) ON DELETE CASCADE;