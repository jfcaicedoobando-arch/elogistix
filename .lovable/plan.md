# Sprint 2 – CxP, Conciliación bancaria BBVA y EERR sobre facturas

Sprint 1 dejó al Contador operando la cobranza (CxC). Sprint 2 cierra el otro lado del ciclo de efectivo: **lo que debemos pagar a proveedores** y **conciliar los movimientos del banco** con CxC/CxP. También migra el Estado de Resultados para que deje de leer proformas y use facturas reales (la fuente fiscal de la verdad).

Con esto el DG ya ve un EERR honesto, el Contador ya cierra mes con cartera y deuda, y dejamos lista la base para Sprint 3 (Comisiones) y Sprint 4 (Tesorería/Flujo).

---

## 1. CxP – Cuentas por Pagar a proveedores

Hoy los `conceptos_costo` viven dentro del embarque pero no existe el concepto de "factura del proveedor" ni su saldo. Vamos a crear el espejo de CxC.

**Base de datos** (migración nueva):
- `proveedor_facturas`: `id`, `organization_id`, `proveedor_id`, `folio_proveedor`, `uuid_fiscal` (opcional), `fecha_emision`, `fecha_vencimiento`, `dias_credito`, `moneda`, `subtotal`, `iva`, `total`, `tipo_cambio_usd`, `estado` (Borrador/Vigente/Pagada/Cancelada), `embarque_id` (nullable), `archivo_pdf_url`, `archivo_xml_url`, `notas`. Multi-tenant + RLS + GRANTs.
- `proveedor_facturas_conceptos`: vincula cada renglón a `conceptos_costo.id` (cuando aplica) para que un costo del embarque sepa en qué factura del proveedor está soportado.
- `pagos_proveedor`: `id`, `proveedor_factura_id`, `fecha_pago`, `monto`, `moneda`, `metodo_pago`, `referencia`, `cuenta_bancaria_id`, `diferencia_cambiaria_mxn`, `notas`.
- `proveedor_notas_credito` (mismo patrón que `factura_notas_credito`).
- Vista `v_proveedor_facturas_saldo` (total − pagos − NC aplicadas) para no recalcular en cliente.

**UI** – Nuevo módulo "CxP" (entrada en sidebar bajo Facturación o nuevo grupo "Tesorería"):
- Tab **Por pagar**: tabla con Folio prov., Proveedor, Embarque, Emisión, Vencimiento, Días vencido, Moneda, Total, Pagado, Saldo, Estatus, Acciones.
- KPIs: Por pagar MXN/USD, Vencido, Por vencer 7d.
- Acciones: Registrar pago, Crear NC, Conciliar con embarque, Ver detalle.
- Tab **Capturar factura proveedor**: formulario que permite (a) capturar manual y (b) vincular conceptos de costo de uno o varios embarques abiertos del mismo proveedor (multiselect).
- `DialogRegistrarPagoProveedor` con diferencia cambiaria MXN cuando aplique.

**Permisos**: contador + admin_org full; comercial/vendedora sin acceso; operador solo lectura del embarque relacionado.

---

## 2. Conciliación bancaria – BBVA

Objetivo: cargar el estado de cuenta y emparejar movimientos con `pagos_factura` (CxC) y `pagos_proveedor` (CxP).

**Base de datos**:
- `cuentas_bancarias`: `id`, `organization_id`, `banco` ('BBVA'…), `alias`, `numero_cuenta`, `clabe`, `moneda`, `activa`.
- `bbva_movimientos`: `id`, `cuenta_bancaria_id`, `fecha`, `concepto`, `referencia`, `cargo`, `abono`, `saldo`, `hash_dedupe` (unique para evitar duplicados al re-importar), `estado_conciliacion` ('Pendiente'/'Conciliado'/'Ignorado'), `pago_factura_id` (nullable), `pago_proveedor_id` (nullable), `importado_en`, `importado_por`.

**Importador**:
- Página **Tesorería → Conciliación**, selector de cuenta + drop-zone para `.xlsx`/`.csv` del estado de cuenta BBVA web. Sin API bancaria por ahora (la conexión directa queda para sprint posterior, ya lo conversamos).
- Parser cliente en `src/lib/import/bbva.ts` (mapa de columnas BBVA México). Detecta layout, normaliza fechas DD/MM/YYYY → ISO, calcula `hash_dedupe = sha1(fecha|concepto|referencia|cargo|abono)`.
- Inserción en batch vía service `services/conciliacion/bbva.ts`. Reporta filas nuevas vs. duplicadas.

**UI Conciliación**:
- Vista a 2 paneles: izq movimientos pendientes BBVA; der candidatos de pago (CxC + CxP filtrados por monto ± tolerancia y fecha ± 5 días).
- Acción "Conciliar" enlaza el movimiento al pago existente; "Crear pago desde movimiento" abre el diálogo correspondiente prellenado (cliente, monto, moneda, fecha, referencia BBVA).
- Acción "Ignorar" (comisiones bancarias, traspasos internos) con motivo.
- Indicador de saldo conciliado vs. saldo libro.

**Fuera de alcance Sprint 2**: API directa BBVA, conciliación automática por IA, multi-banco (Santander, etc. – la arquitectura ya queda lista).

---

## 3. EERR migrado a facturas (cerrar el feature flag)

Hoy `estadoResultados.ts` arma ingresos desde `conceptos_venta` por ETA. Con CxC ya productivo se cambia a la fuente fiscal:

- Ingresos = `facturas` con `estado IN ('Vigente','Pagada')` y `fecha_emision` dentro del mes, menos `factura_notas_credito` con `estado='Aplicada'` en el mes.
- Costos = `proveedor_facturas` con `fecha_emision` dentro del mes (criterio devengado), o alternativamente `conceptos_costo` del embarque cuya ETA cae en el mes — **elegir devengado por factura proveedor** porque ya tendremos CxP.
- Modificar `src/services/profit/estadoResultados.ts` y `src/lib/domain/estadoResultados.ts` para esta nueva consulta. Mantener `EERR_FUENTE` env (`facturas` | `embarques`) durante 1 mes para rollback de emergencia.
- Agregar nueva fila "Notas de crédito" debajo de Ingresos en la tabla.
- Drill-down: clic en una celda abre lista de facturas / facturas-proveedor que la componen.

---

## 4. Tesorería – KPIs ejecutivos (mini-dashboard)

Pequeño dashboard nuevo `/tesoreria` para DG y Contador:
- Saldo en bancos (por cuenta) según última conciliación.
- Total por cobrar / por pagar (MXN equiv).
- Flujo esperado 30 días (vencimientos CxC − CxP).
- Top 5 clientes con deuda vencida, Top 5 proveedores próximos a vencer.

Usa los mismos hooks ya creados; sólo agrega `services/tesoreria/resumen.ts`.

---

## Permisos consolidados Sprint 2

| Módulo | admin_org | contador | comercial | vendedora | operador |
|---|---|---|---|---|---|
| CxP | ✅ | ✅ | — | — | 👁 (solo embarque) |
| Conciliación | ✅ | ✅ | — | — | — |
| Tesorería | ✅ | ✅ | 👁 | — | — |
| EERR | ✅ | ✅ | — | — | — |

---

## Fuera de alcance (futuros sprints, ya identificados)

- **Sprint 3**: Comisiones a vendedora (sobre factura cobrada, no proforma), Reportes ejecutivos PDF, integración Pricing → CRM oportunidades.
- **Sprint 4**: Proyección de flujo de efectivo a 90 días, presupuesto anual vs. real.
- **Sprint 5**: Recordatorios reales por correo (Resend) y WhatsApp Business (investigar costos/onboarding Meta).
- **Sprint 6** (último): CFDI 4.0 timbrado (PAC), Carta Porte queda descartado.

---

## Detalles técnicos clave

- Todas las mutaciones por services (`src/services/cxp/*`, `src/services/conciliacion/*`); nada de `supabase.from()` en componentes.
- Migración separada en 2 archivos: (a) CxP + NC proveedor, (b) cuentas_bancarias + bbva_movimientos. Cada `CREATE TABLE` con sus `GRANT` y RLS por `organization_id`.
- Server-side pagination con `.range()` y debounce en filtros (memoria `mem://technical/server-side-pagination`).
- Componentes ≤200 LOC, sin `any`, cleanup en effects (Power of 10).
- Tests unitarios: parser BBVA (varios layouts), reconciliación de pagos (cálculo de tolerancia ±$1 y ±5 días), saldo CxP.
- Version bump `12.41.0` (CxP) → `12.42.0` (Conciliación) → `12.43.0` (EERR migrado) → `12.44.0` (Tesorería KPIs). Cada uno con su entrada en `CHANGELOG.md` (root).

---

## Entregable del sprint

Contador puede capturar facturas de proveedor, registrar sus pagos, importar el estado de cuenta de BBVA y conciliar contra CxC/CxP en pantalla. DG ve EERR alimentado por la facturación fiscal real y un mini-dashboard de Tesorería con saldo bancario, por cobrar, por pagar y flujo esperado 30 días.

---

## Antes de implementar — confirmaciones

1. **Orden de ejecución**: ¿hacemos los 4 bloques en este sprint, o prefieres partirlo (p.ej. Sprint 2a = CxP, Sprint 2b = Conciliación + EERR + Tesorería)?
2. **Formato BBVA**: ¿el contador descarga **Excel (.xlsx)** o **CSV** del portal BBVA Net Cash? Si tienes un archivo de muestra, súbelo y ajusto el parser al layout real antes de codificar.
3. **Devengado vs. flujo en EERR**: confirmo que costos del mes = facturas de proveedor con fecha en el mes (no pagos). ¿De acuerdo?
4. **Múltiples cuentas BBVA**: ¿hoy operan 1 cuenta MXN, 1 USD, o más? Esto define el selector de cuenta del importador.
