
CREATE POLICY "Permitir eliminar conceptos_venta"
ON public.conceptos_venta FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));

CREATE POLICY "Permitir eliminar conceptos_costo"
ON public.conceptos_costo FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));

CREATE POLICY "Permitir eliminar documentos_embarque"
ON public.documentos_embarque FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));

CREATE POLICY "Permitir eliminar notas_embarque"
ON public.notas_embarque FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));

CREATE POLICY "Permitir eliminar facturas"
ON public.facturas FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));

CREATE POLICY "Permitir eliminar embarques"
ON public.embarques FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));
