CREATE TYPE public.app_role AS ENUM (
    'admin',
    'operador',
    'viewer',
    'super_admin',
    'cliente',
    'vendedor',
    'admin_org',
    'gerente_operaciones',
    'coordinador_logistico',
    'ejecutivo_pricing',
    'contador',
    'tesorero',
    'customer_service',
    'gerente_visor',
    'gerente_comercial',
    'auxiliar_contable',
    'ejecutivo_cobranza',
    'agente_carga'
);
CREATE TYPE public.moneda AS ENUM (
    'MXN',
    'USD',
    'EUR'
);
CREATE TYPE public.estado_proveedor_factura AS ENUM (
    'Borrador',
    'Vigente',
    'Pagada',
    'Cancelada'
);
CREATE TYPE public.estado_aprobacion_factura_proveedor AS ENUM (
    'pendiente',
    'aprobada',
    'rechazada'
);
