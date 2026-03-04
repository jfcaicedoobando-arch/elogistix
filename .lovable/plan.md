

## Plan: Crear tabla `cotizacion_costos`

### Migración SQL

Crear la tabla según la estructura proporcionada, con un ajuste en las políticas RLS para mantener consistencia con el resto del proyecto (admin/operador CRUD, viewer solo lectura):

```sql
CREATE TABLE public.cotizacion_costos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid REFERENCES public.cotizaciones(id) ON DELETE CASCADE NOT NULL,
  concepto text NOT NULL,
  proveedor text,
  moneda text NOT NULL DEFAULT 'USD',
  unidad_medida text,
  costo numeric NOT NULL DEFAULT 0,
  venta numeric NOT NULL DEFAULT 0,
  profit numeric GENERATED ALWAYS AS (venta - costo) STORED,
  porcentaje_profit numeric GENERATED ALWAYS AS (
    CASE WHEN venta = 0 THEN 0
    ELSE ROUND(((venta - costo) / venta) * 100, 2)
    END
  ) STORED,
  seccion text CHECK (seccion IN ('Origen', 'Flete Internacional', 'Destino', 'Otro')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.cotizacion_costos ENABLE ROW LEVEL SECURITY;
```

### Políticas RLS

Reemplazar la política genérica `USING (true)` por el patrón existente del proyecto:

- **Admin y Operador**: CRUD completo
- **Viewer**: Solo lectura

### Trigger

Agregar el trigger `update_updated_at_column` para mantener `updated_at` actualizado automáticamente, como en las demás tablas.

### Changelog

Registrar como versión **4.5.0** en `Changelog.tsx`.

