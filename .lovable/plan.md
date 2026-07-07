# Dashboard Dirección (`/dashboard-direccion`)

Nueva vista ejecutiva para dueño/gerencia. Enrutada aparte para no romper el `/dashboard` operativo actual (que ya rutea por rol). Al final, para roles `admin`, `admin_org`, `super_admin`, `gerente_comercial`, `gerente_visor` mostraremos un enlace/redirección.

## Fuentes de datos (real vs. placeholder)

Todo filtrado por `organization_id` del usuario y excluyendo `deleted_at IS NOT NULL`.

### 1) Fila hero
- **Utilidad bruta del mes** — REAL.
  - Ventana: `embarques.cerrado_at` dentro del mes actual (embarques cerrados = utilidad realizada). Fallback si no hay `cerrado_at`: `eta` del mes.
  - Venta = suma `conceptos_venta.total` de esos embarques, convertida a MXN con `tipo_cambio_usd/eur` del embarque.
  - Costo = suma `conceptos_costo.monto` (misma conversión).
  - Utilidad = Venta − Costo; Margen % = Utilidad/Venta. Compara vs. mismo cálculo del mes anterior (Δ en puntos porcentuales).
- **Cartera vencida** — REAL.
  - `facturas` con `estado IN ('Emitida','Parcial')`, `fecha_vencimiento < today`, no canceladas.
  - Saldo pendiente = `total − Σ pagos_factura.monto_aplicado_factura` por factura (MXN equiv con `tipo_cambio`).
  - Muestra suma y `COUNT(DISTINCT cliente_id)`.
- **Facturación del mes vs meta** — REAL.
  - Suma `facturas.total` (MXN equiv) con `fecha_emision` del mes, `estado != 'Cancelada'`.
  - Meta fija: `META_FACTURACION_MENSUAL_MXN = 5_500_000` en `src/features/dashboard/direccion/constants.ts`.

### 2) Rentabilidad
- **Margen 6 meses** — REAL. Repetir cálculo de utilidad/margen por mes usando `cerrado_at` (o `eta` fallback) de los últimos 6 meses. Mes actual resaltado.
- **Margen por modo** — REAL. Agrupar embarques del mes por `embarques.modo` (maritimo/aereo/terrestre). Barras horizontales con margen %.

### 3) Riesgo y cartera
- **Antigüedad por buckets** — REAL. Facturas con saldo > 0. Buckets por `today − fecha_vencimiento`: `<=0` Corriente, `1-30`, `31-60`, `>60`.
- **Concentración top 5 clientes** — REAL. Suma de utilidad (venta−costo, MXN) por `cliente_id` en el mes; top 5 y su % del margen total.

### 4) Pulso del negocio
- **Embarques activos** — REAL. `embarques.estado` ≠ `Entregado`/`Cancelado`; desglose por estado.
- **Alertas operativas** — PARCIAL:
  - Arribos próximos 7 días → REAL (`eta BETWEEN today AND today+7`).
  - Demoras → REAL si hay `estado='En puerto'` con ETA vencida; si no, placeholder.
  - Documentos vencidos → **placeholder "sin datos"** (no hay campo directo de vencimiento en `documentos_embarque`).
- **Estatus fiscal** — PARCIAL:
  - CFDI timbrados del mes → REAL (`facturas.timbrado_en` en el mes actual, `uuid_fiscal IS NOT NULL`).
  - Acuses de cancelación pendientes → REAL (`estado='Cancelada' AND acuse_cancelacion_status IS DISTINCT FROM 'aceptado'`).

### Placeholders (avisos al usuario)
- **Documentos vencidos** en alertas operativas.
- **Demoras** se reduce a "en puerto sin movimiento" si no hay señal más fina.

## Arquitectura de código

```
src/features/dashboard/direccion/
├── constants.ts                  # META_FACTURACION_MENSUAL_MXN
├── DireccionDashboard.tsx        # página, compone secciones
├── services/
│   ├── kpiHero.ts                # utilidad, cartera, facturación
│   ├── kpiRentabilidad.ts        # 6 meses + por modo
│   ├── kpiCartera.ts             # buckets + top clientes
│   └── kpiPulso.ts               # activos, alertas, fiscal
├── hooks/
│   └── useDireccionKpis.ts       # useQuery orquestador
└── components/
    ├── HeroCards.tsx
    ├── RentabilidadSection.tsx
    ├── CarteraSection.tsx
    └── PulsoSection.tsx
```

Ruta añadida en `src/routes/appRoutes.tsx` protegida por roles ejecutivos. Reutilizamos `formatCurrencyMXN`, `convertirAMXN` y `useExchangeRates` existentes. Charts con `recharts` (ya usado en el proyecto).

## Diseño
- Tarjetas blancas, borde `border-border`, rounded-xl (12px), sombra sutil.
- Tipografía tabular en cifras (`font-variant-numeric: tabular-nums`).
- Semántica de color: `text-destructive`/`bg-destructive/10` para vencido; `text-emerald-600` para positivo; `text-amber-600` advertencia. Todo vía tokens semánticos donde sea posible.
- Grid responsivo: `grid-cols-1 md:grid-cols-3` en hero; `md:grid-cols-2` en secciones intermedias; `md:grid-cols-3` en pulso.

## Fuera de alcance
- No se cambia la lógica del `/dashboard` operativo actual.
- No se agregan tablas nuevas ni migraciones.
- No se implementan documentos vencidos (queda placeholder).

## Changelog
Bump a `13.210.0` + entrada en `CHANGELOG.md`.

---

**Confirma antes de codificar:**
1. ¿Ruta nueva `/dashboard-direccion` o reemplazar `/dashboard` para roles ejecutivos?
2. ¿Base del margen = embarques **cerrados** en el mes (utilidad realizada) o **arribados por ETA** (utilidad devengada)? Propongo cerrados con fallback a ETA.
3. Placeholder confirmado para "documentos vencidos".
