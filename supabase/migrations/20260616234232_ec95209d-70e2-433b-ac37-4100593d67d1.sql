
-- Añadir rol 'contador' a las políticas "Tenant CRUD" que solo permitían admin/operador.
DO $$
DECLARE
  tabla text;
  tablas text[] := ARRAY[
    'clientes','contactos_cliente',
    'conceptos_factura','conceptos_venta','conceptos_costo',
    'facturas','pagos_factura'
  ];
BEGIN
  FOREACH tabla IN ARRAY tablas LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Tenant CRUD '||tabla, tabla);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR ALL
        USING (
          (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
          AND (
            has_role(auth.uid(), 'admin'::app_role)
            OR has_role(auth.uid(), 'operador'::app_role)
            OR has_role(auth.uid(), 'contador'::app_role)
            OR has_role(auth.uid(), 'super_admin'::app_role)
          )
        )
        WITH CHECK (
          (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
          AND (
            has_role(auth.uid(), 'admin'::app_role)
            OR has_role(auth.uid(), 'operador'::app_role)
            OR has_role(auth.uid(), 'contador'::app_role)
            OR has_role(auth.uid(), 'super_admin'::app_role)
          )
        )
    $f$, 'Tenant CRUD '||tabla, tabla);
  END LOOP;
END $$;
