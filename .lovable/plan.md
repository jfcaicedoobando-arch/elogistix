# Master Plan ERP — Elogistix / Libre Carga

## Contexto y objetivo

Hoy el ERP cubre muy bien el **flujo operativo**: CRM → Cotización → Embarque → Pre-Facturación, con un Estado de Resultados básico derivado de conceptos de venta vs. costo por embarque.

Lo que falta para convertirlo en un ERP “de verdad” que soporte a las 5 personas del equipo (DG, Jefa Comercial, Vendedora, Pricing, Contador) y produzca un **Estado de Resultados confiable** son las áreas administrativas, financieras y de gobierno que hoy viven en Excel/correo.

CFDI / timbrado queda **explícitamente fuera de alcance** hasta la fase final.

---

## Mapa de módulos por rol

```text
Director General      → Tablero ejecutivo, Presupuesto vs Real, Tesorería consolidada, Aprobaciones
Jefa Comercial        → Pipeline avanzado, Metas/Comisiones, Tarifario maestro, Forecast de venta
Vendedora             → Mi día, CRM extendido, Cotizador asistido, Seguimiento post-venta
Pricing               → Tarifario maestro (buy/sell), Rate sheets navieras, Recargos, Margen mínimo
Contador              → CxC, CxP, Bancos/Conciliación, Gastos, Nómina ligera, Cierre mensual, EERR
```

---

## Fases (ordenadas por dependencia, no por rol)

### Fase 1 — Cerrar el ciclo financiero del embarque (base del EERR real)

Sin esto, el EERR sigue siendo “teórico”.

1. **Cuentas por Cobrar (CxC)**
  - Documento `factura` (sin CFDI todavía, solo control interno) ligado a pre-factura.
  - Antigüedad de saldos, estados (Emitida, Parcial, Pagada, Vencida, Cancelada).
  - Recordatorios automáticos y notas de crédito internas.
2. **Cuentas por Pagar (CxP)**
  - Captura de facturas de proveedor (naviera, agente, transportista, aduanal) ligadas a `conceptos_costo` del embarque.
  - Validación 3-way match: costo presupuestado vs. concepto cargado vs. factura recibida.
  - Programación de pago, antigüedad y autorizaciones.
3. **Tesorería / Bancos**
  - Catálogo de cuentas bancarias (MXN/USD/EUR).
  - Movimientos bancarios (carga manual + CSV) y **conciliación** contra CxC/CxP.
  - Saldo diario y flujo de caja proyectado a 30/60/90 días desde CxC y CxP.

### Fase 2 — Gastos, activos y costos no operativos

Para que el EERR no se limite a margen por embarque.

4. **Gastos generales / SG&A**
  - Captura de gastos por categoría (renta, software, viáticos, marketing, etc.) y centro de costo.
  - Workflow de comprobación con adjuntos.
5. **Catálogo contable mínimo**
  - Plan de cuentas simplificado (Ingresos, COGS, Gastos Operativos, Financieros, Impuestos).
  - Mapeo: cada `concepto_venta`, `concepto_costo`, gasto general y comisión → cuenta contable.
6. **Activos fijos ligero** (opcional fase 2.5)
  - Registro de activos y depreciación lineal mensual que impacta gastos.

### Fase 3 — Comercial y Pricing como módulos formales

7. **Tarifario maestro (Pricing)**
  - Tarifas buy/sell por naviera, ruta, tipo de contenedor, modo y vigencia.
  - Recargos (BAF, CAF, ISPS, GRI) y márgenes mínimos por cliente/segmento.
  - Cotizador consume tarifario en lugar de captura libre.
8. **Metas y Comisiones**
  - Metas por vendedor/mes (volumen, venta, margen).
  - Esquema de comisiones configurable (% sobre margen liquidado, no sobre venta).
  - Liquidación mensual ligada a embarques cerrados y CxC cobrada.
9. **Pipeline / Forecast comercial avanzado**
  - Forecast ponderado por etapa y probabilidad.
  - Conversión lead → oportunidad → cotización ya existe; añadir **forecast vs. cierre real**.

### Fase 4 — Personas y operación interna

10. **Nómina ligera + Recursos Humanos básico**
  - Catálogo de empleados, puesto, sueldo, prestaciones.
    - Cálculo de nómina mensual (sin timbrado), provisiones (aguinaldo, vacaciones, IMSS estimado).
    - Salida directa al módulo de Gastos.
11. **Aprobaciones y workflows**
  - Aprobaciones para: descuentos fuera de margen mínimo, CxP > monto, gastos > monto, notas de crédito.
    - Bandeja de pendientes por usuario.

### Fase 5 — Cierre, control y dirección

12. **Cierre mensual guiado**
  - Checklist: embarques con ETA del mes facturados, CxP capturadas, gastos del mes, conciliación bancaria, depreciación, nómina, provisiones.
    - “Bloqueo” del periodo cerrado (no se editan documentos con fecha del mes cerrado).
13. **Presupuesto vs. Real**
  - Presupuesto anual por mes/cuenta/centro de costo.
    - Reporte de variaciones y semáforo.
14. **Tablero Dirección General**
  - EERR mensual, YTD y comparativo año anterior.
    - Flujo de caja, DSO/DPO, margen por modo, top clientes/proveedores, comisiones devengadas.

### Fase 6 — CFDI (fuera de alcance hoy)

Timbrado 4.0, complemento de pagos, cancelaciones, addenda. Se diseña al final cuando los módulos 1–5 estén estables; los documentos `factura` ya deben tener los campos fiscales listos para “solo timbrar”.

---

## Detalle técnico (resumen)

- **Multi-tenant**: cada módulo nuevo respeta `organization_id` + RLS + `GRANT`s (CxC, CxP, bancos, gastos, nómina, tarifario, metas, presupuesto).
- **Tablas nuevas principales** (público): `facturas`, `factura_pagos`, `proveedor_facturas`, `proveedor_pagos`, `cuentas_bancarias`, `movimientos_bancarios`, `conciliacion_items`, `gastos`, `cuentas_contables`, `mapeo_contable`, `tarifas`, `tarifa_recargos`, `metas_comerciales`, `comisiones`, `empleados`, `nomina_periodos`, `nomina_conceptos`, `presupuestos`, `periodos_contables`.
- **Cálculos puros** en `src/lib/domain/` (siguiendo patrón de `estadoResultados.ts`): antigüedad, conciliación, comisiones, depreciación, presupuesto vs real.
- **Power of 10**: componentes ≤200 LOC, sin `any`, paginación server-side en listas (`.range()`), cleanup en effects, manejo de `error` de Supabase.
- **Localización**: MXN base, DD/MM/YYYY, es-MX; USD/EUR vía `convertirAMXN` con TC del documento (consistente con EERR actual).
- **Reuso**: extender `lib/financial/financialUtils.ts`, `useTasaIVA`, `useExchangeRates`, `DataTable`, `useOrgFilter`.
- **Edge Functions** nuevas: recordatorios CxC, importador CSV bancario, cálculo de comisiones del periodo, cierre mensual, snapshot EERR.
- **Sin CFDI**: tablas `facturas` y `proveedor_facturas` incluyen campos fiscales (RFC, uso CFDI, forma/método de pago, serie/folio fiscal) **nullables** para timbrar después sin migración disruptiva.

---

## Secuencia recomendada de sprints (alto nivel)

1. CxC + CxP + Bancos/Conciliación (Fase 1) — **desbloquea EERR real**.
2. Gastos + Catálogo contable + mapeo (Fase 2).
3. Tarifario + Comisiones + Forecast (Fase 3).
4. Nómina ligera + Aprobaciones (Fase 4).
5. Cierre mensual + Presupuesto + Tablero DG (Fase 5).
6. CFDI (Fase 6, fuera de alcance hoy).

---

## Preguntas abiertas antes de arrancar la Fase 1

- ¿La numeración de `factura` interna debe ser por organización o global, y arranca en qué folio? La numeracion de facturas es por organizacion, e incluso cada organizacion puede tener varias series de factura con prefijo y consecutivo de numero . 
- ¿Una pre-factura puede generar **una o varias** facturas (split por cliente final/agente)? Asi es, una pregsctura puede tener varios contenedores, algunos clientes quieren 1 sola factura y otros clientes quieren 1 factura por contenedor. 
- ¿Las comisiones se calculan sobre margen **devengado** (al cerrar embarque) o **cobrado** (cuando CxC se paga)? Cuando el CxC se paga. 
- ¿Algún banco específico para importar el primer formato CSV de conciliación (BBVA, Santander, Banorte)? usamos BBVA, podemos investigar en internet cual es la mejor manera de conciliar. 
- ¿Quieres que la Vendedora y Pricing usen el **mismo** tarifario o uno borrador (Pricing) y uno publicado (Vendedora)? Creo que al principio lo mas sencillo es usar el mismo parifario pero dejar preparacion para boorador/publicado.
- Que mas preguntas tienes? Hazme un listado de preguntas para mejor hacer este proceso de master plan.  Las preguntas pueden ir dirigidas a los usuarios o a mi que conozco sobre toda la operacion. 