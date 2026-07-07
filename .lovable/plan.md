
# Consolidación de dashboards ejecutivos

## 1. Diagnóstico rápido

Hoy hay tres dashboards con roles distintos y dos de ellos se traslapan:

| Ruta | Componente | Rol | Estado |
|---|---|---|---|
| `/inicio` | `Dashboard` | Cabina operativa diaria | Se mantiene sin cambios |
| `/profit/dashboard` | `ProfitDashboardEjecutivo` | Vista financiera consolidada (KPIs, EERR 12m, bancos, cartera, CxP, flujo, presupuesto, PDF) | Base de la fusión |
| `/dashboard` | `DireccionDashboard` | Vista de dirección recién creada (utilidad, cartera, meta, margen por modo, top clientes por margen, pulso, semáforo fiscal) | Se absorbe en `/profit/dashboard` |

El Ejecutivo ya cubre 80% de lo que muestra Dirección (utilidad, margen %, cartera vencida, saldos, alertas, top deudores/acreedores, EERR 12m, PDF, selector de periodo). El valor único de Dirección son 5 bloques que se listan abajo.

## 2. Decisión sobre la ruta `/dashboard`

**Recomendado: eliminar el componente `DireccionDashboard` y hacer que `/dashboard` redirija a `/profit/dashboard`** (con `<Navigate replace>`), reutilizando el mismo patrón que ya existe para `/profit` → `/profit/dashboard`.

Razones:
- Evita mantener dos árboles paralelos de servicios/loaders/calculos duplicando cálculo de margen, cartera y CFDI.
- `/dashboard` queda como URL "canónica del dueño": corta, memorable, y siempre aterriza en el ejecutivo consolidado.
- No rompe bookmarks del equipo que ya usaban `/profit/dashboard`.

Alternativas descartadas:
- *Mantener ambos*: perpetúa el traslape que motivó este plan.
- *Renombrar `/profit/dashboard` a `/dashboard`*: rompe deep-links y el resto del módulo Profit vive bajo `/profit/*`; mejor mantener la familia agrupada y usar `/dashboard` como alias-redirect.

## 3. Qué se queda, qué se fusiona, qué se descarta

### Se queda tal cual en `/profit/dashboard`
- `BandaKPIs` (Ingresos, Utilidad, Margen %, Saldo bancos, Cartera vencida, CxP 7d, Cumplimiento presupuesto).
- `GraficoEERR12m` (ingresos/costos/utilidad 12 meses).
- `SaldosBancosCard`.
- `TopListaCard` para **Top 5 deudores** y **Top 5 acreedores** (miden **deuda**, no margen).
- `AlertasPanel`.
- `MiniFlujoCard`.
- `SelectorPeriodo` + export PDF (`ReporteEjecutivoDocument`).

### Se fusiona (traer de Dirección al Ejecutivo)
1. **Meta fija de facturación** — nueva tarjeta al lado/dentro de `BandaKPIs`, con `META_FACTURACION_MENSUAL_MXN` como constante en `src/features/dashboardEjecutivo/constants.ts`. Muestra facturado del mes vs meta + barra de progreso. No sustituye "Cumplimiento presupuesto", que compara vs presupuesto interno; la meta es un objetivo comercial fijo.
2. **Margen % — tendencia 6–12 meses** — derivar `margen_pct = utilidad/ingresos` sobre `eerr12m` ya existente y añadir un pequeño gráfico de líneas/barras (`GraficoMargen12m`) debajo del EERR o como pestaña. Cero I/O extra.
3. **Margen por modo de transporte** — nueva tarjeta `MargenPorModoCard` (marítimo / aéreo / terrestre) para el periodo seleccionado.
4. **Top 5 clientes por MARGEN aportado** — nueva `TopListaCard` (título "Top 5 clientes por margen") en la fila de tops, junto a Deudores/Acreedores. Es una lista distinta a "Top deudores".
5. **Semáforo fiscal** — nueva `SemaforoFiscalCard` (CFDI timbrados del mes + acuses de cancelación pendientes). Va en la columna derecha, cerca de `AlertasPanel`.

### Se descarta por redundancia (ya cubierto por el Ejecutivo)
- Tarjeta "Utilidad bruta del mes" de Dirección → duplica KPI de Utilidad + Margen del Ejecutivo.
- Tarjeta "Cartera vencida" de Dirección → duplica KPI del Ejecutivo.
- Sección "Antigüedad por buckets" → ya vive dentro del módulo de cobranza/reportes; no la reintroducimos en el ejecutivo para no saturar. (Si el dueño la pide, se enlaza desde Alertas.)
- "Embarques activos por estado" y "Arribos 7 días" → operativo puro, pertenece a `/inicio`. Se retira del ejecutivo.
- "Documentos vencidos" placeholder → no se migra; queda como pendiente (ver §5).

## 4. Fuentes de datos para los 5 bloques nuevos

Todo filtrado por `organization_id` y `deleted_at IS NULL`.

1. **Meta $5,500,000 vs facturado del mes**
   - Facturado: `facturas` con `fecha_emision` en el mes del `periodo` seleccionado, `estado != 'Cancelada'`, convertido a MXN con `facturas.tipo_cambio`. Reutiliza el mismo agregado que ya calcula `ingresos_mxn` en `agregador.ts` para no re-consultar.
   - Meta: constante `META_FACTURACION_MENSUAL_MXN` en `src/features/dashboardEjecutivo/constants.ts` (única fuente de verdad).

2. **Margen % tendencia 12 meses**
   - Se deriva en cliente desde `SnapshotEjecutivo.eerr12m[i]` como `utilidad / ingresos`. Sin I/O nuevo.

3. **Margen por modo**
   - Base: `embarques` del periodo (`cerrado_at` en el mes; fallback `eta` en el mes) agrupados por `embarques.modo` (`maritimo` | `aereo` | `terrestre`).
   - Venta: `SUM(conceptos_venta.total)` por embarque → MXN con `embarques.tipo_cambio_usd`/`tipo_cambio_eur` según `moneda`.
   - Costo: `SUM(conceptos_costo.monto)` por embarque, misma conversión.
   - `margen_pct = (venta - costo) / venta`.
   - Reutilizable: `loaders.ts` + `calculos.ts` que ya se crearon para DireccionDashboard se mueven a `src/features/dashboardEjecutivo/services/margenEmbarques.ts` y se integran en el `agregador`.

4. **Top 5 clientes por margen aportado**
   - Mismos agregados de embarques del mes agrupados por `embarques.cliente_id` / `cliente_nombre`.
   - Orden desc por `(venta − costo) MXN`, tomar top 5, calcular `pct = margen_cliente / margen_total_mes`.
   - Nota: el margen "por embarque" es el único cálculo verdaderamente nuevo del Ejecutivo; el resto ya existía.

5. **Semáforo fiscal**
   - CFDI timbrados: `COUNT(facturas)` con `timbrado_en` en el mes y `uuid_fiscal IS NOT NULL`.
   - Acuses pendientes: `COUNT(facturas)` con `estado = 'Cancelada' AND acuse_cancelacion_status IS DISTINCT FROM 'aceptado'`.
   - Ambos ya se consultan (en Dirección) sobre `facturas`; se agregan al `agregador.ts` del Ejecutivo.

### Datos que NO existen hoy → quedan como pendientes
- **Documentos vencidos**: `documentos_embarque` no tiene columna de vencimiento. Pendiente hasta que se agregue `fecha_vencimiento` o política. **No se migra al Ejecutivo consolidado.**
- **Meta comercial por mes/vendedor**: hoy es una sola constante global; si a futuro se quiere meta por org o por mes, mover a `configuracion_global`.
- **Modo "terrestre-cross-border"** granular: hoy `embarques.modo` sólo distingue marítimo/aéreo/terrestre; el sub-tipo cross-border no está modelado.

## 5. Permisos, roles y menú lateral

- **Roles con acceso al ejecutivo**: se conserva `PROFIT_READ_ROLES` (admin, admin_org, super_admin, gerente_comercial, gerente_visor, gerente_operaciones). La redirección `/dashboard → /profit/dashboard` respetará el guardado por rol dentro de Profit.
- **Sidebar** (`src/components/layout/sidebarItems.ts`):
  - Se mantiene la entrada única **"Dashboard Ejecutivo" → `/profit/dashboard`** dentro del grupo Profit/Finanzas.
  - Se elimina cualquier entrada nueva a "Dashboard Dirección" (no debería haber quedado; verificar).
  - `/inicio` (operativo) sigue como "Inicio/Panel" para todos los roles operativos.
- Opcionalmente, para el dueño se puede añadir un shortcut en el `SidebarUserMenu` con la ruta corta `/dashboard` (que redirige), pero no es imprescindible.

## 6. Riesgos

- **Redirección con parámetros**: si alguien guardó `/dashboard?...`, hay que usar `RedirectPreserveSearch` (ya existe en el proyecto) para no perder query params.
- **Costo de la consulta de margen por embarque**: para orgs con muchos embarques al mes puede ser costoso. Mitigación: reutilizar los `select` acotados que ya usa `loaders.ts` (ids + `IN`), cache 60s (mismo `staleTime` que el snapshot ejecutivo).
- **Duplicación de moneda/tipo de cambio**: el Ejecutivo calcula ingresos vía `facturas.tipo_cambio`; el bloque de margen usa `embarques.tipo_cambio_usd/eur`. Documentar la diferencia en el tooltip de cada tarjeta para que el dueño no espere que "Ingresos" y "Venta de embarques del mes" cuadren exactamente.
- **PDF**: `ReporteEjecutivoDocument` debe extenderse para incluir los 3 bloques nuevos que sí van al reporte (meta, margen por modo, top clientes por margen). El semáforo fiscal es opcional en PDF.
- **Guardas de rol**: al eliminar `DireccionDashboard` se debe verificar que su guardado por rol (incluía `gerente_operaciones`) queda cubierto por `PROFIT_READ_ROLES`. Si falta alguno, añadirlo al set.

## 7. Orden sugerido de implementación (por fases)

**Fase 1 — Consolidación de ruta (baja):**
- Reemplazar `<Route path="/dashboard" element={<DireccionDashboard/>}>` por `<Navigate to="/profit/dashboard" replace/>` (usando `RedirectPreserveSearch`).
- Ajustar `PROFIT_READ_ROLES` si falta `gerente_operaciones`.
- Verificar sidebar: sólo una entrada "Dashboard Ejecutivo".

**Fase 2 — Meta fija + margen tendencia (bajo esfuerzo, sin I/O nuevo):**
- Añadir `META_FACTURACION_MENSUAL_MXN` en `src/features/dashboardEjecutivo/constants.ts`.
- Nueva tarjeta "Facturación del mes vs meta" en `BandaKPIs` (o justo debajo).
- Nuevo mini gráfico `GraficoMargen12m` derivado de `eerr12m`.

**Fase 3 — Margen por embarque (medio, nuevo I/O):**
- Portar `loaders.ts` + `calculos.ts` de Dirección a `src/features/dashboardEjecutivo/services/margenEmbarques.ts`.
- Extender `agregador.ts` y `SnapshotEjecutivo` con `margenPorModo` y `topClientesMargen`.
- UI: `MargenPorModoCard` y una `TopListaCard` adicional titulada "Top 5 clientes por margen".

**Fase 4 — Semáforo fiscal (bajo, mismo dominio de facturas):**
- Extender el agregador para calcular `cfdi_timbrados_mes` y `acuses_pendientes`.
- UI: `SemaforoFiscalCard` junto a `AlertasPanel`.

**Fase 5 — Limpieza:**
- Borrar `src/features/dashboard/direccion/**` completo (después de confirmar Fase 3-4 en producción).
- Extender `ReporteEjecutivoDocument` con los bloques nuevos.
- Changelog + bump de versión.

## 8. Diagrama final de superficies

```text
/inicio            → Dashboard operativo (sin cambios)
/dashboard         → Redirect a /profit/dashboard (URL corta del dueño)
/profit/dashboard  → Dashboard Ejecutivo consolidado
   ├── BandaKPIs (+ tarjeta Meta $5.5M)
   ├── EERR 12m + Margen % 12m
   ├── Saldos bancos | Top deudores | Top acreedores | Top clientes por margen
   ├── Margen por modo | Semáforo fiscal | Alertas
   ├── Mini flujo
   └── PDF ejecutivo
```

## 9. Confirma antes de implementar

1. ¿OK con **eliminar `DireccionDashboard` y redirigir `/dashboard`** en vez de mantener dos páginas?
2. Meta $5.5M: ¿global de la org o por organización? Propongo constante global compartida (fase 1) y mover a `configuracion_global` sólo si aparece la necesidad multi-tenant.
3. ¿"Documentos vencidos" queda oficialmente fuera hasta que exista la columna de vencimiento?
