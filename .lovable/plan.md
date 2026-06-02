# Sprint 1 CxC – Capa de aplicación (UI + servicios)

La migración ya está aplicada (`facturas` fiscalizada, `factura_series`, `factura_notas_credito`, `reservar_folio_factura`, `pagos_factura.diferencia_cambiaria_mxn`). Toca exponerla a la operación del Contador y permitir que la cobranza viva dentro del ERP.

## Alcance

1. **Servicios y hooks (capa de datos)**
   - `src/services/facturacion/series.ts`: list/create/update/setDefault + `reservarFolio(serieId)` (RPC).
   - `src/services/facturacion/notasCredito.ts`: CRUD + `aplicarNotaCredito` (marca `estado=Aplicada`, descuenta saldo de la factura origen vía trigger o lógica en service).
   - `src/services/facturacion/cobranza.ts`: listado de facturas con saldo, agrupado por estatus (Vigente / Por vencer / Vencida), filtros por cliente, rango fechas, moneda.
   - `src/hooks/facturacion/useFacturaSeries.ts`, `useNotasCredito.ts`, `useCobranza.ts` (React Query, server-side pagination + debounce, siguiendo `mem://technical/server-side-pagination`).

2. **UI – Tab "Cobranza" en `Facturacion.tsx`**
   - Nuevo tab junto a Proformas/Facturas: tabla con columnas Folio, Cliente, Emisión, Vencimiento, Días vencido, Moneda, Total, Pagado, Saldo, Estatus, Acciones.
   - Zebra-striping, densidad y paginación según `mem://technical/ui-table-standardization` y `mem://features/ui-pagination-density-controls`.
   - Badges de estatus (Vigente / Por vencer ≤3d / Vencida / Pagada / Con NC).
   - Acciones por fila: Registrar pago, Crear nota de crédito, Ver detalle (`e.stopPropagation` en menú).
   - KPIs arriba: Total por cobrar MXN/USD, Vencido, Por vencer 7d (conversión USD→MXN con `useTasaIVA`/exchange-rates cache).

3. **Diálogos**
   - `DialogRegistrarPago`: usa `pagos_factura` existente, agrega campo `diferencia_cambiaria_mxn` cuando la factura es USD y el pago se hace en MXN (cálculo automático con tipo de cambio del día).
   - `DialogNotaCredito`: motivo (enum), monto, moneda heredada, estado inicial `Borrador`. Acciones Aprobar/Aplicar/Cancelar respetando flujo de estados.
   - `DialogAsignarFolio`: al pasar una proforma → factura, reserva folio con `reservar_folio_factura` y captura datos fiscales (`rfc_cliente`, `uso_cfdi`, `forma_pago`, `metodo_pago`, `dias_credito` heredado del cliente).

4. **Configuración → Series de Facturación**
   - Pantalla en módulo Configuración para crear/editar series (solo admin/contador), marcar default, ver folio actual. Default seedeado ('A') ya existe.

5. **EERR**
   - Ajuste de `src/lib/domain/estadoResultados.ts` (y service correspondiente) para leer ingresos desde `facturas` (estado ≠ Cancelada) restando notas de crédito `Aplicada`, en lugar de proformas. Mantener backward compatibility detrás de feature flag `EERR_FUENTE=facturas` por si se necesita rollback.

6. **Recordatorios CxC (preparación, sin enviar correos aún)**
   - Edge function `cxc-recordatorios` (stub) que liste facturas vencidas/por vencer en -3 / +7 / +15 y devuelva JSON. El envío real (Resend/WhatsApp) queda fuera de este sprint.

## Permisos / Roles
- `contador` y `admin_org`: full access a Cobranza, Series, NC.
- `comercial` / `vendedora`: solo lectura sobre cobranza de sus clientes.
- `operador`: sin acceso al tab.
- Usa `has_role` existente; no se modifica el enum `app_role` en este sprint.

## Fuera de alcance (Sprint 1)
- Timbrado CFDI / UUID real (campos quedan opcionales).
- Carta Porte.
- Envío automático de recordatorios por correo/WhatsApp.
- Conciliación bancaria (Sprint 2 – BBVA importer).
- Comisiones (Sprint 3).

## Detalles técnicos clave
- Toda mutación pasa por servicios (no `supabase.from()` en componentes).
- `facturas.saldo` se calcula como `total - SUM(pagos_factura.monto) - SUM(notas_credito.monto WHERE estado='Aplicada')`. Crear vista `v_facturas_saldo` o calcular en hook (preferencia: vista SQL en una micro-migración pequeña dentro del sprint si la performance lo amerita; arrancamos con cálculo en service).
- Conversión USD→MXN usa `useDynamicExchangeRate` (Frankfurter, cache 1h).
- Versionado: bump a `12.40.0` + entrada en `CHANGELOG.md` describiendo Cobranza, Series UI, Notas de Crédito.
- Tests: unitarios para `cobranza.ts` (cálculo de saldo y estatus), `notasCredito.ts` (transiciones de estado), `series.ts` (reserva atómica de folio).

## Entregable
Contador puede: emitir factura desde proforma con folio consecutivo, registrar pagos con diferencia cambiaria, emitir/aplicar notas de crédito, ver cartera vencida y por vencer con KPIs; DG ve EERR alimentado por facturas reales.
