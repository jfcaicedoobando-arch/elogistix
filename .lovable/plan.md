# Tesorería → Pagos (libro maestro de pagos)

Una sola pantalla donde el contador ve **todos** los pagos de la organización: los que recibimos de clientes y los que hicimos a proveedores, con filtros y salto directo a la factura y al movimiento bancario. Es el equivalente a *Contabilidad → Pagos* en Odoo.

## Qué verá el usuario

Nueva ruta `/tesoreria/pagos`, con ítem "Pagos" en el menú de Tesorería (junto a Estado de cuenta).

Estructura:

```text
Pagos                                        [Exportar CSV] [Exportar PDF]
┌ KPIs ───────────────────────────────────────────────────────────────┐
│ Cobrado (periodo)   Pagado (periodo)   Neto   # pagos               │
└─────────────────────────────────────────────────────────────────────┘
[ Recibidos | Realizados | Todos ]
Filtros: rango de fechas · cuenta bancaria · moneda · método de pago SAT
         estado de conciliación · estado de complemento (REP) · búsqueda
┌ Tabla ──────────────────────────────────────────────────────────────┐
│ Fecha │ Tipo │ Contraparte │ Documento │ Método │ Ref │ Monto │ MXN  │
│       │      │             │ (folio)   │        │     │       │ Conc.│
└─────────────────────────────────────────────────────────────────────┘
```

- **Tipo**: Cobro (cliente), Pago (proveedor), Anticipo a proveedor, Pago en lote.
- **Contraparte**: cliente o proveedor.
- **Documento**: folio de la factura (o folio interno FP-xxxxxx en CxP); clic abre el detalle de esa factura.
- **Monto**: en moneda original y su equivalente en MXN al tipo de cambio del pago.
- **Conciliación**: badge Conciliado / Pendiente; si está conciliado, clic lleva al estado de cuenta de esa cuenta bancaria en la fecha del movimiento.
- **Complemento (REP)**: solo aplica a cobros de clientes; muestra Timbrado / Pendiente / Cancelado.
- Fila expandible con notas, usuario que lo registró, diferencia cambiaria y embarque relacionado.
- Búsqueda por referencia, contraparte o folio.
- Exportación CSV y PDF respetando los filtros activos.

Sin cambios en la captura de pagos: esta pantalla solo consulta.

## Detalles técnicos

**Base de datos** — una migración con una función `public.libro_pagos(p_desde date, p_hasta date)`:
- `SECURITY DEFINER`, `SET search_path = public`, acotada a las organizaciones del usuario (mismo patrón de aislamiento que `estado_cuenta_bancario`), `GRANT EXECUTE` solo a `authenticated` y `service_role` (nunca a `anon`).
- Devuelve `jsonb` con la unión de cuatro orígenes, excluyendo registros con `deleted_at`:
  - `pagos_factura` → tipo `cobro` (join `facturas`, `clientes`; incluye `estado_rep`, `serie_rep`/`folio_rep`, `forma_pago`, `cuenta_bancaria_id`, `tipo_cambio`).
  - `pagos_proveedor` → tipo `pago` (join `proveedor_facturas`, `proveedores`; incluye `metodo_pago`, `tipo_cambio_usd`, `lote_id`, `es_anticipo_aplicado`, `es_ajuste`).
  - `anticipos_proveedor` con estado vigente → tipo `anticipo`.
  - Estado de conciliación derivado por `EXISTS` contra `bbva_movimientos` usando `pago_factura_id` / `pago_proveedor_id` / `anticipo_proveedor_id` / `pago_proveedor_lote_id`, devolviendo también el `movimiento_id` y `cuenta_bancaria_id` para el drill-down.
- Equivalente en MXN calculado en SQL con el tipo de cambio guardado en cada pago (no se recalcula ni se consulta el DOF).

**Frontend** (feature `tesoreria`, siguiendo el patrón de Estado de cuenta):
- `domain/libroPagos.ts`: tipos, filtros puros, totales y rango por defecto (mes en curso) — con tests unitarios.
- `services/libroPagos.ts`: llama la RPC y mapea filas.
- `hooks/useLibroPagos.ts`: `useQuery` con `queryKeys.tesoreria.libroPagos(desde, hasta)`.
- `routes/TesoreriaPagos.tsx` + `_sections/`: `LibroPagosToolbar`, `LibroPagosKpis`, `libroPagosColumns.tsx`, `LibroPagosExportButtons` (cada archivo ≤200 líneas, sin `any`).
- Reutiliza `PageContainer` / `PageHeader` / `DataTable` con `TABLE_DENSITY.listado`, `DatePickerMx` para el rango, `formatCurrency` y tokens del design system; filtros persistidos en la URL como en Estado de cuenta.
- PDF vía documento nuevo en `src/pdf/documents/`, mismo patrón que la bitácora de tesorería.
- Registro en `src/constants/routes.ts` (`TESORERIA_PAGOS`), `appRoutes.lazy.ts`, `appRoutes.tsx` con `TESORERIA_READ_ROLES`, `sidebarItems.ts` y la matriz `roleRouteMatrix.ts`.

**Cierre**: entrada en `CHANGELOG.md` y bump de `APP_VERSION`.

## Fuera de alcance

- Editar o eliminar pagos desde esta pantalla (se sigue haciendo en el detalle de cada factura).
- Reportes de antigüedad de saldos (ya existen en CXC/CXP).
- Timbrado de complementos de pago desde el listado.
