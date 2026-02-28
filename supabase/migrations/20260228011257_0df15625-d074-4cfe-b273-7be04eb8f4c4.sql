
-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE public.modo_transporte AS ENUM ('Marítimo', 'Aéreo', 'Terrestre', 'Multimodal');
CREATE TYPE public.tipo_operacion AS ENUM ('Importación', 'Exportación', 'Nacional');
CREATE TYPE public.estado_embarque AS ENUM ('Cotización', 'Confirmado', 'En Tránsito', 'Llegada', 'En Proceso', 'Cerrado');
CREATE TYPE public.estado_documento AS ENUM ('Pendiente', 'Recibido', 'Validado');
CREATE TYPE public.estado_factura AS ENUM ('Borrador', 'Emitida', 'Pagada', 'Vencida', 'Cancelada');
CREATE TYPE public.estado_liquidacion AS ENUM ('Pendiente', 'Pagado');
CREATE TYPE public.moneda AS ENUM ('MXN', 'USD', 'EUR');
CREATE TYPE public.tipo_proveedor AS ENUM ('Naviera', 'Aerolínea', 'Transportista', 'Agente Aduanal', 'Agente de Carga', 'Aseguradora', 'Custodia', 'Almacenes', 'Acondicionamiento de Carga', 'Materiales Peligrosos');
CREATE TYPE public.tipo_servicio_maritimo AS ENUM ('FCL', 'LCL');
CREATE TYPE public.incoterm AS ENUM ('EXW', 'FOB', 'CIF', 'DAP', 'DDP', 'FCA', 'CFR', 'CPT', 'CIP', 'DAT');
CREATE TYPE public.tipo_contacto AS ENUM ('Proveedor', 'Exportador', 'Importador');
CREATE TYPE public.tipo_nota AS ENUM ('nota', 'cambio_estado', 'documento', 'factura', 'sistema');
CREATE TYPE public.origen_proveedor AS ENUM ('Nacional', 'Extranjero');

-- =============================================
-- CLIENTES
-- =============================================
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  rfc text NOT NULL DEFAULT '',
  direccion text NOT NULL DEFAULT '',
  ciudad text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT '',
  cp text NOT NULL DEFAULT '',
  contacto text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y operadores CRUD clientes" ON public.clientes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));

CREATE POLICY "Viewers pueden ver clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

-- =============================================
-- CONTACTOS CLIENTE
-- =============================================
CREATE TABLE public.contactos_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  rfc text NOT NULL DEFAULT '',
  tipo tipo_contacto NOT NULL DEFAULT 'Proveedor',
  pais text NOT NULL DEFAULT '',
  ciudad text NOT NULL DEFAULT '',
  direccion text NOT NULL DEFAULT '',
  contacto text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contactos_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y operadores CRUD contactos" ON public.contactos_cliente
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));

CREATE POLICY "Viewers pueden ver contactos" ON public.contactos_cliente
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

-- =============================================
-- PROVEEDORES
-- =============================================
CREATE TABLE public.proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo tipo_proveedor NOT NULL,
  pais text,
  rfc text NOT NULL DEFAULT '',
  contacto text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  moneda_preferida moneda NOT NULL DEFAULT 'MXN',
  origen_proveedor origen_proveedor,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y operadores CRUD proveedores" ON public.proveedores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));

CREATE POLICY "Viewers pueden ver proveedores" ON public.proveedores
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

-- =============================================
-- EMBARQUES
-- =============================================
CREATE TABLE public.embarques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente text NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  cliente_nombre text NOT NULL DEFAULT '',
  modo modo_transporte NOT NULL,
  tipo tipo_operacion NOT NULL,
  shipper text NOT NULL DEFAULT '',
  consignatario text NOT NULL DEFAULT '',
  descripcion_mercancia text NOT NULL DEFAULT '',
  peso_kg numeric NOT NULL DEFAULT 0,
  volumen_m3 numeric NOT NULL DEFAULT 0,
  piezas integer NOT NULL DEFAULT 0,
  incoterm incoterm NOT NULL DEFAULT 'FOB',
  estado estado_embarque NOT NULL DEFAULT 'Cotización',
  operador text NOT NULL DEFAULT '',
  -- Ruta marítima
  puerto_origen text,
  puerto_destino text,
  naviera text,
  bl_master text,
  bl_house text,
  tipo_servicio tipo_servicio_maritimo,
  contenedor text,
  tipo_contenedor text,
  -- Ruta aérea
  aeropuerto_origen text,
  aeropuerto_destino text,
  aerolinea text,
  mawb text,
  hawb text,
  -- Ruta terrestre
  ciudad_origen text,
  ciudad_destino text,
  transportista text,
  carta_porte text,
  -- Fechas
  etd date,
  eta date,
  fecha_llegada_real date,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  -- Financiero
  tipo_cambio_usd numeric NOT NULL DEFAULT 17.5,
  tipo_cambio_eur numeric NOT NULL DEFAULT 19.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.embarques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y operadores CRUD embarques" ON public.embarques
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));

CREATE POLICY "Viewers pueden ver embarques" ON public.embarques
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

-- =============================================
-- CONCEPTOS VENTA
-- =============================================
CREATE TABLE public.conceptos_venta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  descripcion text NOT NULL,
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario numeric NOT NULL DEFAULT 0,
  moneda moneda NOT NULL DEFAULT 'MXN',
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conceptos_venta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y operadores CRUD conceptos_venta" ON public.conceptos_venta
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));

CREATE POLICY "Viewers pueden ver conceptos_venta" ON public.conceptos_venta
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

-- =============================================
-- CONCEPTOS COSTO
-- =============================================
CREATE TABLE public.conceptos_costo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  proveedor_id uuid REFERENCES public.proveedores(id),
  proveedor_nombre text NOT NULL DEFAULT '',
  concepto text NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  moneda moneda NOT NULL DEFAULT 'MXN',
  estado_liquidacion estado_liquidacion NOT NULL DEFAULT 'Pendiente',
  fecha_pago date,
  referencia_pago text,
  fecha_vencimiento date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conceptos_costo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y operadores CRUD conceptos_costo" ON public.conceptos_costo
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));

CREATE POLICY "Viewers pueden ver conceptos_costo" ON public.conceptos_costo
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

-- =============================================
-- DOCUMENTOS EMBARQUE
-- =============================================
CREATE TABLE public.documentos_embarque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  estado estado_documento NOT NULL DEFAULT 'Pendiente',
  archivo text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documentos_embarque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y operadores CRUD documentos_embarque" ON public.documentos_embarque
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));

CREATE POLICY "Viewers pueden ver documentos_embarque" ON public.documentos_embarque
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

-- =============================================
-- NOTAS EMBARQUE
-- =============================================
CREATE TABLE public.notas_embarque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  fecha timestamptz NOT NULL DEFAULT now(),
  usuario text NOT NULL DEFAULT '',
  tipo tipo_nota NOT NULL DEFAULT 'nota',
  contenido text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notas_embarque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y operadores CRUD notas_embarque" ON public.notas_embarque
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));

CREATE POLICY "Viewers pueden ver notas_embarque" ON public.notas_embarque
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

-- =============================================
-- FACTURAS
-- =============================================
CREATE TABLE public.facturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  embarque_id uuid NOT NULL REFERENCES public.embarques(id),
  expediente text NOT NULL DEFAULT '',
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  cliente_nombre text NOT NULL DEFAULT '',
  subtotal numeric NOT NULL DEFAULT 0,
  iva numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  moneda moneda NOT NULL DEFAULT 'MXN',
  tipo_cambio numeric NOT NULL DEFAULT 1,
  fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date NOT NULL DEFAULT CURRENT_DATE,
  estado estado_factura NOT NULL DEFAULT 'Borrador',
  referencia_bl text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y operadores CRUD facturas" ON public.facturas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));

CREATE POLICY "Viewers pueden ver facturas" ON public.facturas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

-- =============================================
-- CONCEPTOS FACTURA (para desglose de conceptos por factura)
-- =============================================
CREATE TABLE public.conceptos_factura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id uuid NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  descripcion text NOT NULL,
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario numeric NOT NULL DEFAULT 0,
  moneda moneda NOT NULL DEFAULT 'MXN',
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conceptos_factura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y operadores CRUD conceptos_factura" ON public.conceptos_factura
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));

CREATE POLICY "Viewers pueden ver conceptos_factura" ON public.conceptos_factura
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'));

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_proveedores_updated_at BEFORE UPDATE ON public.proveedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_embarques_updated_at BEFORE UPDATE ON public.embarques FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_facturas_updated_at BEFORE UPDATE ON public.facturas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_embarques_cliente_id ON public.embarques(cliente_id);
CREATE INDEX idx_embarques_estado ON public.embarques(estado);
CREATE INDEX idx_conceptos_venta_embarque ON public.conceptos_venta(embarque_id);
CREATE INDEX idx_conceptos_costo_embarque ON public.conceptos_costo(embarque_id);
CREATE INDEX idx_documentos_embarque_embarque ON public.documentos_embarque(embarque_id);
CREATE INDEX idx_notas_embarque_embarque ON public.notas_embarque(embarque_id);
CREATE INDEX idx_facturas_embarque ON public.facturas(embarque_id);
CREATE INDEX idx_facturas_cliente ON public.facturas(cliente_id);
CREATE INDEX idx_contactos_cliente ON public.contactos_cliente(cliente_id);
