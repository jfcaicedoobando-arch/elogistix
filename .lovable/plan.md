# Auditoría exhaustiva — Compras (CxP) y Facturación (CxC)

## Respuesta directa

**¿Está completo?** No.
**¿Se puede operar HOY con clientes reales en México?** Sí para uso interno / piloto controlado, **no** para operación fiscal seria sin resolver los bloqueantes SAT.

El core funcional está construido (proforma → factura → timbrado → pago → REP, alta CFDI proveedor → aprobación → pago → conciliación con embarque). Lo que falta son las **piezas fiscales duras** (validación SAT, DIOT, complementos recibidos, retenciones) y los **cierres de flujo** (auto-liquidación, programación de pagos, aprobaciones multinivel, conciliación bancaria visible desde Compras).

---

## Semáforo global

```text
                 CxP / Compras       CxC / Facturación
Core CRUD           🟢                    🟢
Timbrado SAT        n/a                   🟢
Flujo pago          🟡                    🟢
Retenciones/DIOT    🔴                    🔴
Cancelación SAT     🔴                    🟠
Cobranza            n/a                   🟡
Reportes fiscales   🟡                    🔴
Multi-tenant        🟢                    🟢
```

---

## Bloqueantes para operar (🔴)

### Compras / CxP

1. **UUID CFDI no se valida contra SAT** — un proveedor puede meter facturas canceladas/apócrifas. `proveedor_facturas.uuid_fiscal` se guarda pero nunca se verifica. (`proveedorFacturas.helpers.ts:94`)
2. **Retenciones ISR/IVA no se aplican en el pago** — el CFDI trae `retenciones` pero `registrarPagoProveedor` paga bruto. Riesgo fiscal real con PF. (`pagosProveedor.ts:44-95`)
3. **DIOT ausente** — sin generación mensual del archivo para SAT. Requerido por ley.
4. **Complemento de pago recibido (CFDI del proveedor) ausente** — no hay flujo para recibir/vincular el complemento; el pago no es deducible.
5. **Cancelación de facturas de proveedor sin lógica SAT** — sólo soft delete; no revierte pagos/NC ni valida saldo. (`softDeleteFacturaProveedor`)

### Facturación / CxC

6. **Acuse de cancelación SAT no se guarda** — `cancelarFacturapi()` devuelve `{sustituida}` pero no descarga ni persiste el XML de acuse SAT. Obligatorio SAT 2022+. (`facturapi.ts:69-94`)
7. **Catálogos SAT incompletos** — sólo 5 usos CFDI (faltan D01-D10, CP01, CN01) y 6 formas de pago de 22. (`catalogosSAT.ts:6-21`)
8. **Número provisional `MAN-{timestamp}` en factura manual** — se muestra al usuario antes de timbrar; si se imprime/envía es número inválido fiscalmente. (`facturaManual.ts:79`)
9. **REP sin reintento automático** — si falla el complemento en un PPD, el pago queda sin CFDI de pagos. SAT exige REP en el mes siguiente. Reintento sólo manual. (`useRegistrarPagoSubmit.ts:38-55`)

---

## Importantes (🟠)

### Compras

- **Auto-liquidación**: registrar un pago NO marca `conceptos_costo.estado_liquidacion='Pagado'`; hay que ir manualmente al embarque. Inmanejable con volumen.
- **Programación de pagos**: no existe `fecha_programada_pago` ni pantalla de "orden de pago" ni proyección de flujo de efectivo desde CxP.
- **Aprobaciones multinivel**: un solo nivel; no hay matriz por monto / área / categoría.
- **NC de proveedor con CFDI**: sin carga de XML de la nota de crédito; aplicación por `UPDATE` sin constraint DB (race condition posible).
- **Conciliación bancaria BBVA no visible desde Compras**: `bbva_movimientos.pago_proveedor_id` vive sólo en Tesorería; el contador no ve si el pago se confirmó bancariamente desde CxP.

### Facturación

- `**cobranza_seguimiento` y `factura_recordatorios` son tablas huérfanas** (0 código en `features/`). La "promesa de pago" y los "recordatorios automáticos" que menciona la ayuda no existen en el front.
- **Sin reporte de antigüedad de saldos CxC** (aging sí existe en CxP en `/compras/aging`).
- **Addenda no implementada** — Walmart, Coppel, Femsa exigen XML addenda; bloquea vender a grandes clientes.
- **NC sin validación de monto ≤ saldo** al aplicar (posible saldo negativo).
- **Portal cliente no descarga REP ni NC**, sólo la factura principal.
- **Respaldo XML propio**: los URLs apuntan a FacturAPI; si termina el contrato, se pierden los XML (a diferencia de CxP que sí replica en bucket `facturas` con `cfdiStorage.ts`).

---

## Nice-to-have (🟡)

- Contabilidad electrónica / pólizas XML (Anexo 24 SAT).
- Flujo de caja proyectado desde CxP (vencimientos).
- Margen por embarque expuesto en Compras (existe `pnlPorContenedor.helpers.ts` en embarques).
- Múltiples cuentas bancarias por proveedor.
- Condiciones de crédito en el maestro de proveedor (hoy sólo en cada factura).
- Listado nominativo CFDI.
- Cursor pagination (hoy `limit(2000)` hardcoded en `fetchCobranza`, `fetchFacturas`, `reportesFetch`).

---

## Deuda técnica reseñable (no bloquea operar, pero suma fricción)

- `useNuevaFacturaProveedorForm.ts` (199) y `CxpFiltros.tsx` (193) al límite del techo de 200 líneas.
- `DialogCrearNotaCredito.tsx` (198) mezcla form + IVA + servicios.
- Rollback manual en `crearFacturaManual` (no transaccional).
- `as never` en `set_facturapi_api_key` / `clear_facturapi_api_key` (tipos no regenerados).
- Comentario explícito de deuda en `Cxp.tsx:79` ("pendiente Oleada 5").
- Sin E2E del flujo proforma → factura → timbrado → pago → REP.

---

## Roadmap propuesto (para tu aprobación)

Recomiendo atacar en 4 olas ordenadas por **desbloqueo fiscal** y **desbloqueo operativo**, no por complejidad técnica.

### Ola 1 — Blindaje fiscal (2–3 iteraciones)

1. Guardar acuse SAT de cancelación (Facturación) — descargar XML y persistir en `facturas.acuse_cancelacion_url`.
2. Completar catálogos SAT: usos CFDI y formas de pago (Facturación) — extender `catalogosSAT.ts`.
3. Verificación de UUID CFDI contra SAT en alta de factura proveedor (Compras) — nueva edge function + estado `uuid_verificado`.
4. Reintento automático nocturno de REP fallidos (Facturación) — cron edge function + KPI en dashboard.
5. Sustituir `MAN-{timestamp}` por serie/folio real desde el borrador o bloquear envío/impresión hasta timbrar.

### Ola 2 — Cierre de flujo operativo (2 iteraciones)

6. Auto-liquidación: trigger que actualiza `conceptos_costo.estado_liquidacion` al registrar pago proveedor.
7. Programación de pagos: campo `fecha_programada_pago`, bandeja "por programar" y "por ejecutar", proyección semanal.
8. Mostrar estado de conciliación bancaria en el detalle de factura proveedor (unir con `bbva_movimientos`).
9. Cancelación de factura proveedor con lógica: valida saldo, revierte NC, marca embarque.

### Ola 3 — Fiscal avanzado (3 iteraciones)

10. Retenciones ISR/IVA en `registrarPagoProveedor` (tabla `retenciones_pago` con desglose por tasa).
11. Módulo DIOT: pantalla de generación mensual + export TXT/XML para el SAT.
12. Complemento de pago recibido: carga XML, vincula a `pagos_proveedor`, valida contra el SAT.
13. Aging de saldos CxC + reporte de antigüedad.
14. Respaldo automático de XML de facturas emitidas al bucket `facturas`.

### Ola 4 — Escala y contabilidad (opcional)

15. Aprobaciones multinivel (matriz por monto/área).
16. Cobranza operativa: reactivar `cobranza_seguimiento` + `factura_recordatorios` con UI y cron.
17. Addenda por cliente (Walmart, Coppel, Femsa).
18. Contabilidad electrónica (Anexo 24).
19. Cursor pagination global.

---

## ¿Qué construir primero?

Mi recomendación: **arrancar por la Ola 1 (blindaje fiscal)**, específicamente los items **1, 2, 4, 5**, porque:

- Son los que te exponen a multas SAT si operas con clientes reales HOY.
- Todos son cambios contenidos (< 1 día cada uno) y no requieren rediseño.
- El item 3 (validación UUID) requiere una edge function nueva — se puede paralelizar.

Confirma cuál ola/items quieres que implemente y lo desglosamos en planes concretos.

Empezamos por Ola 1