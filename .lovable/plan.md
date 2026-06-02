# Sprint 4 — Flujo de caja 90 días + Presupuesto vs Real

Cierra el ciclo financiero: ya tenemos EERR, Cartera, Tesorería y Comisiones. Falta **anticipar** (flujo proyectado a 90 días) y **controlar** (presupuesto mensual vs ejecutado). Sprint 5 quedará para recordatorios automáticos (Resend/WhatsApp).

Versión: `12.47.0` (flujo 90d) → `12.48.0` (presupuesto). Entrega corrida.

---

## 1. Flujo de caja proyectado a 90 días (12.47.0)

**Regla de negocio:**
- Horizonte: 90 días desde hoy, agrupado por semana ISO (13 semanas).
- **Entradas esperadas**: `facturas` no pagadas con `fecha_vencimiento` en ventana + cobros parciales pendientes.
- **Salidas esperadas**: `proveedor_facturas` no pagadas con `fecha_vencimiento` en ventana + liquidaciones de comisión pendientes.
- **Saldo inicial**: suma de `cuentas_bancarias.saldo_actual` (última conciliación).
- **Saldo proyectado semana N** = saldo inicial + Σ(entradas 1..N) − Σ(salidas 1..N).
- Alertas: marcar semanas con saldo proyectado < 0 (rojo) o < umbral configurable (ámbar).

### Backend (sin migración nueva — usa datos existentes)
- `src/services/tesoreria/flujoProyectado.ts`: 
  - `fetchFlujoProyectado(dias=90)` → consulta paralela facturas/cxp/liquidaciones/cuentas, agrupa por semana, devuelve `{ semanas: SemanaFlujo[], saldoInicial, alertas }`.
  - Tipos: `SemanaFlujo { semana_iso, inicio, fin, entradas_mxn, salidas_mxn, saldo_proyectado_mxn, detalle_entradas[], detalle_salidas[] }`.

### UI
- Nueva tab en `/tesoreria` → **"Flujo 90 días"** (junto a Cuentas / Conciliación).
- `src/pages/tesoreria/TesoreriaFlujo.tsx`: 
  - KPIs arriba: Saldo hoy, Entradas 90d, Salidas 90d, Saldo final proyectado.
  - Gráfico de barras apiladas (Recharts ya en stack): entradas verdes / salidas rojas + línea de saldo acumulado.
  - Tabla detallada por semana: expandible para ver facturas/cxp que componen cada celda.
  - Botón "Descargar PDF" → reutiliza `ReporteTesoreriaDocument` extendido con sección flujo.

### Componentes (≤200 LOC c/u)
- `src/pages/tesoreria/TesoreriaFlujo.tsx`
- `src/components/tesoreria/GraficoFlujoProyectado.tsx`
- `src/components/tesoreria/TablaFlujoSemanal.tsx`
- `src/services/tesoreria/flujoProyectado.ts`
- `src/hooks/tesoreria/useFlujoProyectado.ts`
- `src/lib/query/keys/tesoreria.ts` (añadir `flujoProyectado`)

---

## 2. Presupuesto vs Real (12.48.0)

**Regla de negocio:**
- Presupuesto mensual por **categoría de gasto operativo** (no por embarque). Categorías: Nómina, Renta, Servicios, Marketing, Comisiones, Otros (editable).
- Captura: admin/contador define monto presupuestado por categoría por mes (YYYY-MM).
- Real: agrega `proveedor_facturas` + liquidaciones de comisión por categoría/mes.
- Variación: `real − presupuesto`. Color: verde si real ≤ presupuesto, rojo si excede.

### Migración (12.48.0)
- `presupuesto_categorias`: `id`, `organization_id`, `nombre`, `orden`, `activa`, `created_at`. RLS por org.
- `presupuesto_mensual`: `id`, `organization_id`, `categoria_id` (FK), `periodo` (YYYY-MM), `monto_mxn`, `notas`, `creado_por`, timestamps. Unique (`org`, `categoria`, `periodo`). RLS por org.
- `proveedor_facturas.categoria_presupuesto_id uuid` nullable (opcional, para mapear gasto).
- GRANTs estándar (`authenticated` r/w admin/contador, `service_role` ALL).
- Seed: 6 categorías por defecto al crear la primera fila de la org (función `seed_presupuesto_categorias(org_id)`).

### UI
- Nueva página `/profit/presupuesto` (sidebar bajo Profit).
- Tabs:
  - **Captura**: tabla editable categorías × meses (12 columnas año actual). Inputs in-place con autosave debounced.
  - **Vs Real**: selector de periodo (mes / trimestre / año), tabla `Categoría | Presupuesto | Real | Variación | % cumpl.`. KPIs: Total presup., Total real, Variación neta.
  - **Configuración**: alta/baja/edición de categorías.
- Botón "Descargar PDF" → nuevo `ReportePresupuestoDocument`.

### Componentes
- `src/pages/profit/ProfitPresupuesto.tsx` (tabs)
- `src/components/presupuesto/{TabCaptura,TabVsReal,TabCategorias,DialogCategoria}.tsx`
- `src/services/presupuesto/{categorias,mensual,vsReal}.ts`
- `src/hooks/presupuesto/{usePresupuestoCategorias,usePresupuestoMensual,usePresupuestoVsReal}.ts`
- `src/lib/query/keys/presupuesto.ts` (registrar en `EXPECTED_DOMAINS`)
- `src/pdf/documents/ReportePresupuestoDocument.tsx`

### Integración CxP
- En `DialogNuevaFacturaProveedor`: nuevo `Select` "Categoría presupuestal" (opcional). Permite mapear gasto al presupuesto.

---

## Detalles técnicos

- **Sin nuevos secrets**: ambos features se calculan sobre datos existentes + tablas nuevas.
- **Multi-tenant**: todas las nuevas tablas con `organization_id`, RLS basado en `user_belongs_to_org`.
- **Permisos**: `admin`/`contador` full en ambos. `comercial`/`vendedor`/`operador` sin acceso.
- **Power of 10**: ningún archivo > 200 LOC; cleanup en effects (gráficos Recharts no requieren teardown manual).
- **Tests**: actualizar `EXPECTED_DOMAINS` con `presupuesto`. Unit test para `fetchFlujoProyectado` (agrupación por semana ISO) y para cálculo de variación.
- **CHANGELOG + APP_VERSION**: bump 12.47.0 y 12.48.0.

---

## Orden de ejecución

1. **12.47.0**: servicio + hook + tab `/tesoreria` (Flujo 90d) + extensión PDF Tesorería.
2. **12.48.0**: migración presupuesto + servicios/hooks + página `/profit/presupuesto` + integración CxP + nuevo PDF.
3. Tests verdes + `EXPECTED_DOMAINS` + CHANGELOG.

## Fuera de alcance Sprint 4

- Forecast con ML/estacionalidad (sólo proyección determinista por vencimientos).
- Presupuesto por embarque/proyecto (sólo categorías operativas).
- Recordatorios automáticos por email/WhatsApp → **Sprint 5** con Resend.
- Aprobación multi-nivel del presupuesto.
