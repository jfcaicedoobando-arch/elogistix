## Objetivo

Sección **"Historial"** plegable dentro del dialog de detalle de factura (debajo de los KPIs) que muestre, como línea de tiempo unificada:

- Captura de la factura (fecha + quién — si está disponible).
- Aprobación / Rechazo (fecha + email + motivo).
- Pagos registrados (fecha + monto + método + email).
- Notas de crédito aplicadas.
- Eliminación / restauración (soft delete).

## Por qué una vista en BD

Los eventos viven en 4 tablas distintas (`proveedor_facturas`, `bitacora_actividad`, `pagos_proveedor`, `proveedor_notas_credito`) y los emails de los usuarios viven en `auth.users` — que el cliente no puede leer directamente. Una **función SQL `SECURITY DEFINER`** unifica todo y resuelve los emails una sola vez.

## Cambios

### 1. Migración: `public.historial_proveedor_factura(p_id uuid)`

Función `SECURITY DEFINER` que retorna `TABLE (ts timestamptz, tipo text, descripcion text, actor_email text, monto numeric, moneda text, detalles jsonb)` y hace `UNION ALL` de:

- `proveedor_facturas.created_at` → tipo `creada`, actor desde `created_by` join `auth.users`.
- `proveedor_facturas.aprobada_at` cuando `estado_aprobacion <> 'pendiente'` → tipo `aprobada` o `rechazada`.
- `bitacora_actividad` con `entidad_id = p_id` y `modulo='cxp'` → tipo derivado de `accion` (cubre acciones futuras).
- `pagos_proveedor` (no eliminados) → tipo `pago`, monto/moneda/método.
- `proveedor_notas_credito` → tipo `nota_credito`.
- `proveedor_facturas.deleted_at` cuando `IS NOT NULL` → tipo `eliminada`.

**Seguridad**: la función primero verifica que el usuario pertenezca a la `organization_id` de la factura (`SELECT organization_id ... WHERE id=p_id` + `EXISTS organization_members`). Si no, `RAISE EXCEPTION`. `GRANT EXECUTE ... TO authenticated`. `REVOKE` a `anon`.

Orden de retorno: `ORDER BY ts ASC`.

### 2. Service & hook

- `src/features/cxp/services/historialFactura.ts` — `fetchHistorialFactura(facturaId)` que invoca la RPC.
- `src/features/cxp/hooks/useHistorialFactura.ts` — `useQuery` con key `["cxp","historial",facturaId]`. Invalidación al aprobar/rechazar/pagar (se añade en los hooks existentes).

### 3. UI: `HistorialFacturaSection.tsx`

- `<Collapsible>` (shadcn) con header "Historial" + contador de eventos + icono `History`.
- Body: línea de tiempo vertical (reusa estilo de `BitacoraActividad`: borde izquierdo + dots por tipo de evento).
- Cada fila: icono según `tipo`, `formatDate(ts)` relativo + absoluto en tooltip, descripción, `actor_email` (badge), y para pagos: `formatCurrency(monto, moneda)`.
- Estado vacío: "Sin eventos registrados aún".

Iconos por tipo: `FilePlus2` (creada), `Check` (aprobada), `X` (rechazada), `Banknote` (pago), `FileMinus2` (nota_credito), `Trash2` (eliminada).

### 4. Insertar en el dialog

En `DialogDetallePagosProveedor.tsx`, debajo del grid de KPIs (línea 65-74), montar `<HistorialFacturaSection facturaId={factura.id} />` envuelto en su propio `border-b` para separación visual. Colapsado por defecto para no agrandar el dialog en vista normal.

### 5. Versionado

- `APP_VERSION` → `13.104.0` (minor: nueva feature).
- Entrada en `CHANGELOG.md`.

## Fuera de alcance

- Filtros / búsqueda dentro del historial (volumen esperado <50 por factura).
- Exportar historial a PDF.
- Edición o reversión de eventos desde la línea de tiempo.
