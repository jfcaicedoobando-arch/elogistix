

## Plan: Modulo de Cotizaciones — v3.6.0

### Enfoque

Crear una tabla independiente `cotizaciones` con campos simplificados (cliente, mercancia, modo, conceptos de venta como JSONB, vigencia, estado). Al confirmar una cotizacion, se crea automaticamente un embarque nuevo con los datos de la cotizacion. La pagina `/cotizaciones` lista todas las cotizaciones con filtros, y `/cotizaciones/nueva` tiene un formulario simplificado.

### 1. Migracion de base de datos

Nueva tabla `cotizaciones`:

```sql
CREATE TYPE public.estado_cotizacion AS ENUM ('Borrador', 'Enviada', 'Confirmada', 'Rechazada', 'Vencida');

CREATE TABLE public.cotizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text NOT NULL,
  cliente_id uuid NOT NULL,
  cliente_nombre text NOT NULL DEFAULT '',
  modo modo_transporte NOT NULL,
  tipo tipo_operacion NOT NULL,
  incoterm incoterm NOT NULL DEFAULT 'FOB',
  descripcion_mercancia text NOT NULL DEFAULT '',
  peso_kg numeric NOT NULL DEFAULT 0,
  volumen_m3 numeric NOT NULL DEFAULT 0,
  piezas integer NOT NULL DEFAULT 0,
  origen text NOT NULL DEFAULT '',
  destino text NOT NULL DEFAULT '',
  conceptos_venta jsonb NOT NULL DEFAULT '[]',
  subtotal numeric NOT NULL DEFAULT 0,
  moneda moneda NOT NULL DEFAULT 'MXN',
  vigencia_dias integer NOT NULL DEFAULT 15,
  fecha_vigencia date,
  notas text,
  estado estado_cotizacion NOT NULL DEFAULT 'Borrador',
  embarque_id uuid,  -- se llena al confirmar
  operador text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;

-- RLS policies (misma logica que embarques)
CREATE POLICY "Admins y operadores CRUD cotizaciones" ON public.cotizaciones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador'));

CREATE POLICY "Viewers pueden ver cotizaciones" ON public.cotizaciones
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'));

-- Trigger updated_at
CREATE TRIGGER update_cotizaciones_updated_at
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Hook `src/hooks/useCotizaciones.ts`

- `useCotizaciones()` — lista todas, orden desc por created_at
- `useCotizacion(id)` — detalle individual
- `useCreateCotizacion()` — inserta nueva cotizacion con folio auto-generado (COT-YYYY-NNNN)
- `useUpdateCotizacion()` — actualiza campos editables
- `useConfirmarCotizacion()` — cambia estado a "Confirmada", crea embarque via `useCreateEmbarque` y guarda el `embarque_id` en la cotizacion

### 3. Pagina `src/pages/Cotizaciones.tsx`

Lista con:
- Boton "Nueva Cotizacion"
- Tabla: Folio, Cliente, Modo, Origen → Destino, Subtotal, Estado, Vigencia, Fecha
- Filtros: busqueda, estado, cliente
- Paginacion (10 por pagina)
- Click en fila navega a `/cotizaciones/:id`

### 4. Pagina `src/pages/NuevaCotizacion.tsx`

Formulario simplificado (1 pagina, sin wizard):
- Cliente (select), Modo, Tipo operacion, Incoterm
- Descripcion mercancia, Peso, Volumen, Piezas
- Origen y Destino (texto libre)
- Conceptos de venta (filas dinamicas: descripcion, cantidad, precio unitario, moneda)
- Vigencia en dias (default 15)
- Notas
- Boton "Guardar Cotizacion"

### 5. Pagina `src/pages/CotizacionDetalle.tsx`

- Resumen de la cotizacion con todos los datos
- Tabla de conceptos de venta
- Boton "Confirmar y Crear Embarque" (solo si estado es Borrador o Enviada) — abre AlertDialog de confirmacion, al aceptar crea el embarque y marca la cotizacion como Confirmada
- Boton "Marcar como Enviada" / "Marcar como Rechazada"
- Si ya fue confirmada, muestra link al embarque creado

### 6. Conversion cotizacion → embarque

Al confirmar:
1. Crea embarque con datos de la cotizacion (modo, tipo, cliente, incoterm, mercancia, peso, volumen, piezas) y estado "Cotización" del enum de embarques
2. Inserta conceptos de venta del JSONB como filas en `conceptos_venta`
3. Actualiza la cotizacion con `estado = 'Confirmada'` y `embarque_id = <nuevo_id>`
4. Registra en bitacora
5. Redirige al detalle del embarque creado

### 7. Integracion

- `App.tsx` — 3 rutas nuevas: `/cotizaciones`, `/cotizaciones/nueva`, `/cotizaciones/:id`
- `AppSidebar.tsx` — nuevo item "Cotizaciones" con icono `FileText` o `ClipboardList` debajo de Dashboard
- `Changelog.tsx` — entrada v3.6.0

### Archivos nuevos
- `src/hooks/useCotizaciones.ts`
- `src/pages/Cotizaciones.tsx`
- `src/pages/NuevaCotizacion.tsx`
- `src/pages/CotizacionDetalle.tsx`

### Archivos modificados
- `src/App.tsx` — 3 rutas
- `src/components/AppSidebar.tsx` — menu item
- `src/pages/Changelog.tsx` — v3.6.0

