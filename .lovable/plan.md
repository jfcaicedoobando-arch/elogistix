# Sprint 3 – Comisiones a vendedora + Reportes ejecutivos PDF

Cierra el ciclo comercial: ya tenemos CxC (Sprint 1), CxP / Conciliación / EERR / Tesorería (Sprint 2). Falta **pagar a la vendedora lo que generó** y entregar **PDFs firmables** de cierre mensual al DG y al contador.

Versiones: `12.45.0` (comisiones) → `12.46.0` (reportes PDF). Entrega corrida.

---

## 1. Comisiones a vendedora — base de utilidad cobrada

**Regla de negocio acordada:**
- Base = **utilidad bruta del embarque** = ingreso facturado − costos del embarque (`conceptos_costo` o `proveedor_facturas` ligadas vía `embarque_id`).
- Devengo = **al cobrar la factura**, prorrateado: `comision_devengada = (cobrado / total_factura) × utilidad × % vendedora`.
- Vendedora = nuevo campo `vendedora_id` en `embarques` (asignación manual, sin default desde cliente).

### Base de datos (migración 12.45.0)

- `embarques.vendedora_id uuid` nullable + índice. RLS hereda.
- `vendedora_config`: `id`, `organization_id`, `user_id` (FK a `profiles.user_id`, rol `vendedor`), `porcentaje_default numeric(5,2)`, `activa bool`, `fecha_alta`.
- `comision_overrides` (opcional, queda para Sprint 5): por cliente o ruta. **Sprint 3 sólo usa `porcentaje_default`.**
- `comisiones_devengadas` (vista materializada o tabla calculada vía RPC):
  - `id`, `pago_factura_id` (FK), `embarque_id`, `factura_id`, `vendedora_id`, `monto_cobrado_mxn`, `utilidad_prorrateada_mxn`, `porcentaje_aplicado`, `comision_mxn`, `estado` (`Devengada` / `Liquidada` / `Cancelada`), `liquidacion_id` (nullable), `creada_en`.
  - Se inserta automáticamente por trigger `AFTER INSERT ON pagos_factura` y se reversa en `pagos_factura.deleted_at` o NC `Aplicada`.
- `liquidaciones_comision`: cabecera del pago a la vendedora: `id`, `organization_id`, `vendedora_id`, `periodo` (`YYYY-MM`), `total_mxn`, `fecha_pago`, `metodo_pago`, `referencia`, `creada_por`. RLS: admin + contador full, vendedora ve sólo las suyas.

GRANTs estándar (`authenticated` para roles relevantes, `service_role` ALL). RLS por `organization_id` + `vendedora_id = auth.uid()` en lectura propia.

### Cálculo (RPC SECURITY DEFINER `calcular_comision_pago(p_pago_factura_id uuid)`)

```text
utilidad_embarque = SUM(conceptos_venta.monto_mxn) − SUM(conceptos_costo.monto_mxn)
proporcion_cobro  = pago.monto_aplicado_factura / factura.total
comision_mxn      = utilidad_embarque × proporcion_cobro × (vendedora.porcentaje_default / 100)
```

Si el embarque no tiene `vendedora_id` o costos cerrados → registra `Devengada` con `comision_mxn = 0` y `nota = 'Sin vendedora asignada' | 'Costos pendientes'` para que el contador lo vea.

### UI (`/comisiones`, sidebar bajo Tesorería)

- **Tab Devengadas**: tabla agrupable por vendedora/periodo: Fecha cobro, Cliente, Factura, Embarque, Utilidad, % aplicado, Comisión MXN, Estado. Filtros: vendedora, periodo, estado. KPIs: Devengado mes, Pendiente liquidar, Liquidado mes.
- **Tab Liquidaciones**: lista de liquidaciones por periodo. Acción "Generar liquidación del mes" agrupa todas las `Devengadas` de la vendedora seleccionada → crea `liquidaciones_comision` + actualiza `comisiones_devengadas.estado='Liquidada'`. Acción "Registrar pago" (fecha, método, referencia).
- **Vista vendedora**: misma página filtrada a sus propias comisiones (RLS), sin acciones de liquidar.
- **Permisos**: `admin`/`contador` full; `vendedor` solo lectura propia; `comercial`/`operador` sin acceso.

### Componentes (≤200 líneas c/u)
- `src/pages/comisiones/Comisiones.tsx` (tabs)
- `src/components/comisiones/{TabDevengadas,TabLiquidaciones,DialogNuevaLiquidacion,DialogRegistrarPagoComision,comisionesColumns}.tsx`
- `src/services/comisiones/{devengadas,liquidaciones}.ts`
- `src/hooks/comisiones/{useComisionesDevengadas,useLiquidacionesComision,useComisionMutations}.ts`
- `src/lib/query/keys/comisiones.ts` (registrar en `EXPECTED_DOMAINS` para no romper test).

### Integración en embarque
- Form de embarque: nuevo `Select` "Vendedora asignada" (lista usuarios con rol `vendedor` de la org). Sin default. Editable mientras el embarque no esté `Liquidado`.

---

## 2. Reportes ejecutivos PDF — EERR + Cartera + Tesorería

Entrega: 3 PDFs descargables/imprimibles desde sus respectivas páginas. Usamos `@react-pdf/renderer` (ya está en stack si no, lo instalo en este sprint) para tener layout estable y soporte tipográfico Inter.

### Componentes compartidos
- `src/lib/pdf/theme.ts`: paleta marca (`#1B2B4B`, `#2563EB`), fuentes Inter, márgenes A4/Letter.
- `src/lib/pdf/{HeaderEmpresa,FooterPaginado,TablaPDF,KPIRow}.tsx`: encabezado con logo + org, pie con fecha de generación y "Generado por {user}".
- Hook `useGenerarPDF(reporte)` que renderiza a Blob + dispara download con nombre estandarizado `Reporte_{tipo}_{org}_{periodo}.pdf`.

### Reporte 1 — EERR mensual (`ReporteEERR.pdf`)
- Cabecera: org, periodo, fuente (Devengada/Operativa, según toggle ya existente).
- Cuerpo: tabla mensual con Ingresos, Notas de crédito, Ingresos netos, Costos directos, Utilidad bruta, %, Gastos operativos, EBITDA. Comparativo mes anterior.
- Anexo opcional (checkbox antes de generar): desglose por embarque.
- Botón "Descargar PDF" en `/profit/estado-resultados`.

### Reporte 2 — Cartera CxC + CxP (`ReporteCartera.pdf`)
- Sección A — CxC: aging buckets (0-30, 31-60, 61-90, +90), por cliente, totales MXN/USD. Top 10 deudores.
- Sección B — CxP: mismo aging por proveedor, próximos 7/15/30 días.
- Botón "Descargar PDF" en `/facturacion` (tab Cobranza) y `/cxp`.

### Reporte 3 — Tesorería (`ReporteTesoreria.pdf`)
- Saldos por cuenta bancaria (última conciliación + fecha).
- Por cobrar / por pagar / posición neta.
- Flujo esperado 30 días (línea por semana, CxC vs CxP).
- Top 5 deudores vencidos + Top 5 vencimientos próximos.
- Botón "Descargar PDF" en `/tesoreria`.

Permisos: `admin`/`contador` los 3. `comercial` solo Cartera. `vendedora` sólo Liquidación de sus comisiones (queda fuera de este sprint, en backlog).

---

## Detalles técnicos

- **Trigger comisiones**: en `pagos_factura` `AFTER INSERT/UPDATE` llama `calcular_comision_pago(NEW.id)`. En `factura_notas_credito` `AFTER UPDATE` cuando pasa a `Aplicada`, reversa proporcionalmente.
- **Idempotencia**: la RPC usa `ON CONFLICT (pago_factura_id) DO UPDATE` para que recalcular un pago no duplique.
- **Multi-tenant**: todas las nuevas tablas con `organization_id`, RLS basado en `user_belongs_to_org`, GRANTs sólo a roles que las necesitan.
- **Tests**: actualizar `EXPECTED_DOMAINS` en `keys-shape.test.ts` con `comisiones`. Unit test del cálculo de comisión con casos: cobro parcial, sin vendedora, sin costos, con NC aplicada.
- **CHANGELOG + APP_VERSION**: bump 12.45.0 (comisiones) y 12.46.0 (PDFs).
- **Power of 10**: ningún archivo > 200 líneas; services separan I/O de UI; cleanup en effects de PDF (revocar `URL.createObjectURL`).

---

## Orden de ejecución

1. Migración comisiones + RPC + trigger (12.45.0).
2. Servicios + hooks + UI `/comisiones` + asignación de vendedora en embarque.
3. Bump 12.46.0 — librería PDF + theme compartido + 3 reportes con botón de descarga.
4. Tests verdes + actualizar `EXPECTED_DOMAINS` + CHANGELOG.

## Fuera de alcance Sprint 3

- Comisiones por cliente / por ruta (override). Sprint 5.
- Recibo de comisión firmado por vendedora dentro del PDF. Backlog.
- Envío automático de los PDFs por email mensual (esperará Sprint 5 con Resend).
- Reporte ejecutivo de comisiones por vendedora (queda para Sprint 5).
