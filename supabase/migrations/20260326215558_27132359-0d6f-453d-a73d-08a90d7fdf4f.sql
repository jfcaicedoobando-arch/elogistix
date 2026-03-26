
-- CONCEPTOS_VENTA
DROP POLICY IF EXISTS "Admins y operadores CRUD conceptos_venta" ON public.conceptos_venta;
DROP POLICY IF EXISTS "Viewers pueden ver conceptos_venta" ON public.conceptos_venta;
DROP POLICY IF EXISTS "Permitir eliminar conceptos_venta" ON public.conceptos_venta;

CREATE POLICY "Tenant CRUD conceptos_venta" ON public.conceptos_venta FOR ALL TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')))
  WITH CHECK ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Tenant viewer conceptos_venta" ON public.conceptos_venta FOR SELECT TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND has_role(auth.uid(), 'viewer'));

-- CONCEPTOS_COSTO
DROP POLICY IF EXISTS "Admins y operadores CRUD conceptos_costo" ON public.conceptos_costo;
DROP POLICY IF EXISTS "Viewers pueden ver conceptos_costo" ON public.conceptos_costo;
DROP POLICY IF EXISTS "Permitir eliminar conceptos_costo" ON public.conceptos_costo;

CREATE POLICY "Tenant CRUD conceptos_costo" ON public.conceptos_costo FOR ALL TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')))
  WITH CHECK ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Tenant viewer conceptos_costo" ON public.conceptos_costo FOR SELECT TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND has_role(auth.uid(), 'viewer'));

-- CONCEPTOS_FACTURA
DROP POLICY IF EXISTS "Admins y operadores CRUD conceptos_factura" ON public.conceptos_factura;
DROP POLICY IF EXISTS "Viewers pueden ver conceptos_factura" ON public.conceptos_factura;

CREATE POLICY "Tenant CRUD conceptos_factura" ON public.conceptos_factura FOR ALL TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')))
  WITH CHECK ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Tenant viewer conceptos_factura" ON public.conceptos_factura FOR SELECT TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND has_role(auth.uid(), 'viewer'));

-- CONTACTOS_CLIENTE
DROP POLICY IF EXISTS "Admins y operadores CRUD contactos" ON public.contactos_cliente;
DROP POLICY IF EXISTS "Viewers pueden ver contactos" ON public.contactos_cliente;

CREATE POLICY "Tenant CRUD contactos_cliente" ON public.contactos_cliente FOR ALL TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')))
  WITH CHECK ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Tenant viewer contactos_cliente" ON public.contactos_cliente FOR SELECT TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND has_role(auth.uid(), 'viewer'));

-- COTIZACION_COSTOS
DROP POLICY IF EXISTS "Admins y operadores CRUD cotizacion_costos" ON public.cotizacion_costos;
DROP POLICY IF EXISTS "Viewers pueden ver cotizacion_costos" ON public.cotizacion_costos;

CREATE POLICY "Tenant CRUD cotizacion_costos" ON public.cotizacion_costos FOR ALL TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')))
  WITH CHECK ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Tenant viewer cotizacion_costos" ON public.cotizacion_costos FOR SELECT TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND has_role(auth.uid(), 'viewer'));

-- DOCUMENTOS_EMBARQUE
DROP POLICY IF EXISTS "Admins y operadores CRUD documentos_embarque" ON public.documentos_embarque;
DROP POLICY IF EXISTS "Viewers pueden ver documentos_embarque" ON public.documentos_embarque;
DROP POLICY IF EXISTS "Permitir eliminar documentos_embarque" ON public.documentos_embarque;

CREATE POLICY "Tenant CRUD documentos_embarque" ON public.documentos_embarque FOR ALL TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')))
  WITH CHECK ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Tenant viewer documentos_embarque" ON public.documentos_embarque FOR SELECT TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND has_role(auth.uid(), 'viewer'));

-- NOTAS_EMBARQUE
DROP POLICY IF EXISTS "Admins y operadores CRUD notas_embarque" ON public.notas_embarque;
DROP POLICY IF EXISTS "Viewers pueden ver notas_embarque" ON public.notas_embarque;
DROP POLICY IF EXISTS "Permitir eliminar notas_embarque" ON public.notas_embarque;

CREATE POLICY "Tenant CRUD notas_embarque" ON public.notas_embarque FOR ALL TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')))
  WITH CHECK ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Tenant viewer notas_embarque" ON public.notas_embarque FOR SELECT TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND has_role(auth.uid(), 'viewer'));

-- EVENTOS_EMBARQUE
DROP POLICY IF EXISTS "Admins y operadores CRUD eventos_embarque" ON public.eventos_embarque;
DROP POLICY IF EXISTS "Viewers pueden ver eventos_embarque" ON public.eventos_embarque;

CREATE POLICY "Tenant CRUD eventos_embarque" ON public.eventos_embarque FOR ALL TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')))
  WITH CHECK ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Tenant viewer eventos_embarque" ON public.eventos_embarque FOR SELECT TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND has_role(auth.uid(), 'viewer'));

-- CONFIGURACION
DROP POLICY IF EXISTS "Admins pueden modificar configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Autenticados pueden leer configuracion" ON public.configuracion;

CREATE POLICY "Tenant admin configuracion" ON public.configuracion FOR ALL TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  WITH CHECK ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Tenant read configuracion" ON public.configuracion FOR SELECT TO authenticated
  USING (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'));

-- BITACORA_ACTIVIDAD
DROP POLICY IF EXISTS "Admins ven toda la bitacora" ON public.bitacora_actividad;
DROP POLICY IF EXISTS "Usuarios ven sus propias acciones" ON public.bitacora_actividad;
DROP POLICY IF EXISTS "Autenticados pueden insertar bitacora" ON public.bitacora_actividad;

CREATE POLICY "Tenant admin bitacora" ON public.bitacora_actividad FOR SELECT TO authenticated
  USING ((organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Tenant user own bitacora" ON public.bitacora_actividad FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() AND organization_id = current_user_org_id());

CREATE POLICY "Tenant insert bitacora" ON public.bitacora_actividad FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() AND (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin')));
