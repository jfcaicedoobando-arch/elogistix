# Estado de Cuenta — Portal cliente + ERP interno (v13.298.0)

Nuevo módulo de "Estado de Cuenta" con KPIs, tabla de facturas colapsables (pagos + notas de crédito anidados), filtros de rango de fecha y flag "sólo con saldo", montado en **dos rutas espejo** que comparten un único componente `<EstadoCuentaModule>`.

## Rutas

- `/portal/estado-de-cuenta` — cliente autenticado, resuelve `cliente_id`s vía `usePortalClientUsers()`.
- `/facturacion/clientes/:clienteId/estado-de-cuenta` — cobranza interna, un cliente específico. Enlace añadido desde `ClienteDetalle` y `BandejaVencidas`.

## Arquitectura de componentes

```text
features/facturacion/estadoCuenta/
├── routes/
│   └── EstadoCuentaInterno.tsx        (page, ~80 líneas)
├── components/
│   ├── EstadoCuentaModule.tsx         (shell reutilizado por ambas rutas, ~120 líneas)
│   ├── EstadoCuentaKpiCards.tsx       (3 KpiCard: adeudado, vencido, a favor)
│   ├── EstadoCuentaFilters.tsx        (rango + toggle "sólo con saldo")
│   ├── EstadoCuentaTable.tsx          (DataTable con filas expandibles)
│   ├── EstadoCuentaRowExpanded.tsx    (detalle pagos + notas de una factura)
│   └── ExportActions.tsx              (placeholder disabled, listo para PDF/XLSX)
├── hooks/
│   ├── useEstadoCuenta.ts             (orquestador: cliente_ids + filtros → datos)
│   └── useEstadoCuentaDateRange.ts    (patrón useFacturacionDateRange, con presets)
└── services/
    ├── estadoCuenta.ts                (fetchEstadoCuenta: facturas + pagos + NC embebidos)
    └── estadoCuentaAggregates.ts      (calcularKpisEstadoCuenta: adeudado/vencido/a favor)

features/portal/routes/
└── PortalEstadoCuenta.tsx             (wraps <EstadoCuentaModule modo="portal"/>)
```

## Reuso del sistema de diseño (cero componentes duplicados)

| Necesidad | Se reusa |
|---|---|
| Layout de página | `PageContainer` + `PageHeader` (portal usa `PortalPageHeader`) |
| KPIs | `KpiCard` con `variant="destructive"` (vencido), `variant="default"` (adeudado), `variant="success"` (a favor) |
| Tabla | `DataTable` + `defineColumns<MovimientoRow>()` con paginación cliente, densidad compacta, striped, `renderSubRow` para expandido |
| Filas expandibles | `expanded` state nativo de TanStack Table ya soportado por `DataTable` |
| Rango de fecha | Nuevo hook `useEstadoCuentaDateRange` calcado sobre `useFacturacionDateRange` (mismo patrón `?desde=&hasta=`) + presets `Últimos 30d / Este mes / Este año / Histórico` |
| Formato moneda | `formatCurrency` / `formatUSD` de `@/lib/formatters` — **prohibido `toLocaleString` inline en celdas** |
| Formato fecha | `formatDate` de `@/lib/formatters` |
| Aritmética | `sumarMontos` de `financialUtils` (currency.js, sin drift) |
| Query segura portal | Extiende `services/queries.ts` con `fetchPortalEstadoCuenta(clienteIds)` — mismas RLS que ya protegen `fetchPortalFacturas` |

## KPIs (tarjetas superiores)

Cálculo puro en `estadoCuentaAggregates.ts`, agrupado por moneda (MXN/USD lado a lado):

- **Saldo Total Adeudado** = Σ `saldo` de facturas con `saldo > 0` y estatus ∈ (`Vigente`, `Por vencer`, `Vencida`). Variant `default` si 0, `warning` si > 0.
- **Saldo Vencido** = Σ `saldo` con `estatus = 'Vencida'`. Variant `destructive` si > 0, `success` si 0. Sublabel: `N facturas vencidas`.
- **Saldo a Favor / Anticipos** = Σ pagos con `monto_no_aplicado > 0` + notas de crédito con `saldo_disponible > 0`. Variant `success` cuando > 0.

## Tabla de movimientos (facturas colapsables)

Columnas (fila principal = factura):

| Col | Formato | Ordenable |
|---|---|---|
| Fecha | `formatDate(fecha_emision)` | sí |
| Folio | Link a detalle factura | sí |
| Concepto | "Factura {serie}-{folio}" o "Nota de cargo …" | – |
| Cargo | `formatCurrency(total, moneda)` clase `text-foreground` | sí |
| Abono | `formatCurrency(pagado + nc_aplicada, moneda)` clase `text-success` | sí |
| Saldo insoluto | `formatCurrency(saldo, moneda)` bold, rojo si vencida | sí |
| Estatus | `<Badge>` con color semántico | sí |
| ▸ | Toggle expandir |

**Sub-fila expandida** (`EstadoCuentaRowExpanded`): tabla ligera con pagos aplicados (fecha, método, referencia, monto) + notas de crédito aplicadas (fecha, folio NC, monto). Estado colapsado por default; sólo se abre bajo demanda.

Diferenciación visual cargos vs abonos por color de columna + icono en Fecha (`ArrowUpCircle` verde para pagos/NC en sub-fila, `FileText` neutro para factura en fila principal).

## Filtros

`EstadoCuentaFilters.tsx`:

- **Presets de rango** (chips): `Últimos 30 días` (default), `Este mes`, `Trimestre actual`, `Este año`, `Histórico completo`. Sincronizados a querystring vía `useEstadoCuentaDateRange`.
- **Rango custom**: `DateRangePicker` shadcn cuando el usuario elige "Personalizado".
- **Toggle "Sólo con saldo pendiente"**: `Switch` que filtra `saldo > 0`. Encendido por default en portal; apagado en modo interno.
- **Moneda**: `Select` MXN | USD | Todas (default Todas).

## Datos

`fetchEstadoCuenta({ clienteIds, desde, hasta, moneda, soloConSaldo })`:

```sql
select facturas.*, 
       pagos_factura(id, fecha_pago, metodo_pago, referencia, monto_aplicado_factura, monto_no_aplicado, deleted_at),
       factura_notas_credito(id, folio, fecha_emision, monto, monto_aplicado, saldo_disponible, estado, deleted_at)
  from facturas
 where cliente_id in :clienteIds
   and fecha_emision between :desde and :hasta
   and estado != 'cancelada'
 order by fecha_emision desc
 limit 2000;
```

Mismo shape que `fetchCobranza` — extiende sus tipos para no duplicar el mapeo de `estatus_cobranza`. En modo portal se llama vía `services/portal/queries.ts` para respetar RLS del portal.

## Preparación para exportación

`ExportActions.tsx` renderiza 2 botones (`FileDown` PDF / `Sheet` Excel) **disabled con tooltip "Próximamente"**. El módulo queda estructurado para que cuando llegue la implementación real:

1. Los datos ya vienen normalizados desde `useEstadoCuenta` (una fuente de verdad).
2. Los formateadores son puros y reutilizables server-side.
3. Ver `ExportActions.tsx` — comentario `// TODO(v13.299): generar PDF via jsPDF-autotable con misma columna spec`.

## Detalles técnicos

- **Sin cambios de BD**: se usan tablas existentes (`facturas`, `pagos_factura`, `factura_notas_credito`).
- **RLS portal**: se apoya en policies ya vigentes para `fetchPortalFacturas`. Si `factura_notas_credito` no está expuesta al rol `authenticated` con la misma política, se abrirá vía `GRANT SELECT` + policy `EXISTS (select 1 from facturas f where f.id = factura_notas_credito.factura_id and f.cliente_id in (client_users_del_usuario))` en migración separada (fuera de este PR si no aplica).
- **Cleanup**: los hooks siguen `queryOptions` de tanstack query — sin `useEffect` con canales realtime.
- **Tests** (Power of 10 + coverage):
  - `estadoCuentaAggregates.test.ts`: KPIs con mix MXN/USD, con y sin saldo a favor.
  - `useEstadoCuentaDateRange.test.ts`: presets cambian querystring correctamente.
  - `EstadoCuentaTable.test.tsx`: expandir/colapsar sub-fila, filas se pintan rojas cuando vencidas.
- **Sin `any`**, todos los archivos ≤ 200 líneas, componentes ≤ 200 líneas.
- **Cambios en rutas**:
  - `src/routes.tsx`: registrar `/facturacion/clientes/:clienteId/estado-de-cuenta`.
  - `src/routes/portalRoutes.tsx`: registrar `/portal/estado-de-cuenta` + link en `PortalNavigation`.
  - `ClienteDetalle`: botón "Ver estado de cuenta".
  - `BandejaVencidas`: enlace por fila.
- **Versión**: bump `APP_VERSION` a `13.298.0` + entrada `CHANGELOG.md`.

## Entregables al terminar

1. Página interna funcional en `/facturacion/clientes/:clienteId/estado-de-cuenta`.
2. Página portal en `/portal/estado-de-cuenta` con las mismas KPIs, tabla y filtros.
3. Componente `EstadoCuentaModule` compartido — una sola fuente de UI.
4. Servicios y agregados puros con tests unitarios.
5. Botones de exportación presentes y desactivados, listos para conectar en el siguiente sprint.
