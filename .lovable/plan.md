
# Master Plan ERP — Elogistix / Libre Carga (v2, post-discovery)

Plan consolidado tras la sesión de descubrimiento. Cierre fiscal (CFDI) sigue **fuera de alcance** hasta Fase 6. Go-live objetivo: **Junio 2026**, arranque **en limpio** (sin migración histórica).

---

## 1. Decisiones de diseño ya cerradas

Estas decisiones se aplican transversalmente a todos los módulos:

- **Series de factura**: 1 sola serie por organización al inicio, pero el modelo soporta N series con prefijo + consecutivo.
- **Crédito**: por cliente, **días naturales**.
- **Anticipos**: no se facturan ni aplican (fuera de alcance).
- **Notas de crédito**: existen, sin aprobación hoy → se añadirá workflow.
- **FX**: factura USD se puede cobrar en USD (cuenta USD) o MXN al TC del día de pago → módulo registra diferencia cambiaria.
- **Split de proforma → facturas**: por contenedor; prorrateo de conceptos compartidos **a definir** (default propuesto: por contenedor; configurable a peso/valor).
- **Recordatorios CxC**: nuevos, en −3, día, +7, +15 (correo cliente + aviso interno).
- **CxP**: pagos contra recepción hoy → migrar a **1–2 días fijos/semana** para proveedores con crédito; tolerancia 3-way match ±5% / ±$500; **provisiones** de costo al cerrar embarque sin factura.
- **Proveedores**: catálogo nuevo, carga automática via **CSF (parse-csf existente)**.
- **Bancos**: 1 MXN + 1 USD (BBVA); soportar export estándar BBVA Empresas (.xlsx/.txt) **y** BBVA Net Cash CSV; conciliación **semanal**, módulo simple.
- **Sin caja chica, sin gastos a comprobar, sin activos fijos formales** (solo registro opcional simple para laptops/celulares).
- **Centros de costo**: se implementan ligados a modos del EERR (Marítimo, Aéreo, Terrestre, Admin, Comercial).
- **Pricing**: captura manual, tarifa Spot vigencia 1 semana, mayormente por contenedor; alertas si venta < margen mínimo; aprobación DG **y** Jefa Comercial.
- **Comisiones**: solo Vendedora, esquema simple (% sobre margen cobrado), **solo al 100% cobrado**, con **clawback** si hay devolución/cancelación, **metas mensuales**.
- **Nómina**: outsourcing → solo se captura **1 factura mensual** de proveedor; no hay RH interno.
- **Aprobaciones DG**: workflow formal con **auto-aprobación para gastos recurrentes/menores**.
- **Cierre mensual**: día 10 del mes siguiente; reportes firmados = **EERR + CxC vencidas**.
- **Roles**: nuevos roles formales (`director_general`, `jefa_comercial`, `vendedora`, `pricing`, `contador`) + migración desde `app_role` actual; Vendedora solo ve sus clientes/embarques/comisiones; Contador ve todo (incluye buy rate).
- **Histórico**: arranque limpio en go-live; sin migración.
- **Externos**: WhatsApp Business diferido a Fase 6+; sin Carta Porte.

---

## 2. Fases y orden de sprints

```text
Fase 1  CxC + CxP + Bancos              ── desbloquea EERR real
Fase 2  Gastos + Plan de cuentas + CC   ── EERR completo
Fase 3  Tarifario + Comisiones + Metas  ── comercial formal
Fase 4  Nómina outsourcing + Workflows  ── operación interna
Fase 5  Cierre + Presupuesto + Tablero  ── control y dirección
Fase 6  CFDI + WhatsApp Business        ── fuera de alcance hoy
```

### Fase 1 — Ciclo financiero (Sprints 1–4)

- **S1 — CxC**: tabla `facturas` (campos fiscales nullables), series/folios por org, estados, antigüedad, notas de crédito internas (con aprobación DG configurable).
- **S2 — Cobranza**: pagos parciales, FX USD↔MXN con diferencia cambiaria, recordatorios automáticos (Edge Function cron + correo).
- **S3 — CxP**: catálogo de proveedores con **alta vía CSF**, captura de facturas de proveedor ligadas a `concepto_costo`, 3-way match con tolerancia ±5%/±$500, provisiones automáticas al cerrar embarque.
- **S4 — Bancos**: cuentas MXN/USD, importador BBVA Empresas (.xlsx/.txt) + BBVA Net Cash (CSV), conciliación semanal simple (match manual asistido), saldo y flujo 30/60/90.

### Fase 2 — Gastos y contabilidad (Sprints 5–6)

- **S5 — Gastos generales**: captura por categoría + centro de costo (Marítimo/Aéreo/Terrestre/Admin/Comercial), adjuntos, sin workflow de comprobación.
- **S6 — Plan de cuentas + mapeo**: catálogo simple construido desde cero (template inicial), mapeo `concepto_venta`/`concepto_costo`/`gasto`/`comisión` → cuenta contable; EERR ahora muestra SG&A real.

### Fase 3 — Comercial (Sprints 7–9)

- **S7 — Tarifario maestro**: tarifas buy/sell por naviera/ruta/contenedor/modo, vigencia (default semanal), recargos dinámicos (BAF/LSS/GRI). Borrador/publicado **preparado** pero misma tarifa al inicio.
- **S8 — Margen mínimo + alertas**: regla por modo/cliente/ruta, alerta + bloqueo blando que requiere aprobación DG o Jefa Comercial.
- **S9 — Comisiones + metas**: % simple sobre margen **cobrado** (CxC en estado Pagada), liquidación mensual, clawback automático si cancelación/devolución, metas mensuales por vendedora.

### Fase 4 — Operación interna (Sprint 10)

- **S10 — Nómina outsourcing + Workflows aprobación**: factura mensual de outsourcing como CxP especial (se mapea a SG&A); workflow de aprobaciones con bandeja DG, **reglas de auto-aprobación** por monto/categoría/recurrencia (gastos recurrentes y menores no notifican DG).

### Fase 5 — Cierre y dirección (Sprints 11–13)

- **S11 — Cierre mensual guiado**: checklist día 10 (facturas emitidas del mes, CxP capturadas, provisiones, conciliación bancaria, comisiones liquidadas), bloqueo de periodo.
- **S12 — Presupuesto vs Real**: presupuesto anual por mes/cuenta/CC, variaciones con semáforo.
- **S13 — Tablero DG**: KPIs recomendados:
  - Diario: cash disponible (MXN+USD), CxC vencida >30d, embarques en riesgo, ventas día/mes vs meta, margen promedio del mes.
  - Mensual: EERR, DSO, DPO, margen por modo y CC, top 5 clientes, top 5 proveedores, comisiones devengadas vs liquidadas.

### Fase 6 — Diferidos

- CFDI 4.0 (timbrado, complemento pagos, cancelaciones).
- Integración WhatsApp Business (notificaciones a clientes y aprobaciones DG).

---

## 3. Detalle técnico

- **Multi-tenant**: cada tabla nueva con `organization_id`, RLS con `has_role`, GRANT a `authenticated`/`service_role`.
- **Roles nuevos**: ampliar enum `app_role` con `director_general`, `jefa_comercial`, `vendedora`, `pricing`, `contador`; migración de usuarios existentes en script. Vendedora: filtros server-side por `vendedor_asignado_id` (cliente, embarque, comisión).
- **Tablas nuevas principales**:
  - CxC: `facturas`, `factura_pagos`, `factura_notas_credito`, `factura_series`.
  - CxP: `proveedores` (extendida con datos CSF), `proveedor_facturas`, `proveedor_pagos`, `proveedor_provisiones`.
  - Bancos: `cuentas_bancarias`, `movimientos_bancarios`, `conciliacion_items`, `importacion_bancaria_jobs`.
  - Gastos/contabilidad: `gastos`, `centros_costo`, `cuentas_contables`, `mapeo_contable`.
  - Comercial: `tarifas`, `tarifa_recargos`, `metas_comerciales`, `comisiones`, `comision_movimientos` (incluye clawback).
  - Workflows: `aprobaciones`, `aprobacion_reglas` (auto-aprobación).
  - Cierre: `periodos_contables`, `presupuestos`, `presupuesto_lineas`.
- **Campos fiscales nullables** en `facturas` y `proveedor_facturas` (RFC, uso CFDI, forma/método pago, UUID, serie/folio fiscal) → Fase 6 solo timbra.
- **Cálculos puros** en `src/lib/domain/` (antigüedad, conciliación, comisiones, 3-way match, diferencia cambiaria, prorrateo, presupuesto vs real, EERR ampliado).
- **Edge Functions nuevas**:
  - `cxc-recordatorios` (cron diario, correo cliente + bitácora).
  - `bbva-importer` (parsea .xlsx/.txt/.csv).
  - `comisiones-calcular` (cron mensual sobre CxC pagada).
  - `cierre-mensual` (snapshot EERR + bloqueo periodo).
  - `proveedor-csf-importer` (reutiliza `parse-csf` para alta de proveedores).
- **Reuso**: `lib/financial/financialUtils.ts`, `useTasaIVA`, `useExchangeRates`, `DataTable`, `useOrgFilter`, `convertirAMXN`, `safeLocalStorage`.
- **Power of 10** en todo: componentes ≤200 LOC, sin `any`, paginación server-side, cleanup en effects, manejo de `error` de Supabase, sin inline styles estáticos.
- **CHANGELOG.md** + bump `APP_VERSION` por cada sprint.
- **Tests**: domain puros 100%, services con mocks Supabase, hooks con RTL, edge functions con Deno test, E2E Playwright (login → cotización → embarque → proforma → factura → cobro → conciliación).

---

## 4. Decisiones que aún hay que cerrar (no bloquean Sprint 1)

Estas se pueden resolver durante el sprint correspondiente:

1. **Prorrateo de conceptos compartidos** al partir proforma en N facturas → propuesta default: **por contenedor**, con override manual por línea.
2. **Umbrales de auto-aprobación** (monto MXN para gastos recurrentes y menores) → definir junto con DG antes de Fase 4.
3. **Plantilla inicial del plan de cuentas** → propongo borrador simple (Ingresos / COGS / SG&A / Financieros / Impuestos) en Fase 2 para que Contador lo ajuste.
4. **Esquema exacto de % de comisión** (plano vs escalonado) → arrancar plano configurable por vendedora en Fase 3.

---

## 5. Próximo paso recomendado

Arrancar **Sprint 1 (CxC)** que es lo que desbloquea el EERR real y es independiente del resto:

1. Migración: tabla `facturas` + `factura_series` + `factura_pagos` + `factura_notas_credito` con RLS y GRANTs.
2. Backfill: una serie default por organización existente.
3. UI: extender `Facturacion.tsx` con tab "Cobranza" (antigüedad + acciones).
4. Hook + service de cobranza, recordatorios (Edge Function en S2).
5. EERR pasa a leer `facturas` (no proforma) para reconocer ingreso.

Cuando apruebes este plan, paso a build mode y arranco con la migración de Sprint 1.
