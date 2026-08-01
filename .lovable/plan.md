# Ronda 5 — cierre de pendientes (P1 y P2)

Los P0 (cotización `Solicitada` costeable, captura manual de CxP) y varios P2 (bancarios, precarga de naviera, IVA MXN, P&L presupuestado) ya quedaron aplicados en v13.389.0. Este plan cubre lo que sigue abierto del documento de la Ronda 5.

## 1. P1-2 · Detalle de factura y toast falso al timbrar

- La FK `facturas_proforma_id_fkey` **sí existe** en la base, así que el error crudo que vieron los auditores fue caché de esquema de la capa de datos, no un esquema roto. Aun así el embed es frágil: se quita `proformas:proformas!facturas_proforma_id_fkey(numero)` del select y se obtiene el número de proforma con una segunda consulta por `proforma_id`, igual que ya se hace con `sustituida_por`.
- En "Crear y timbrar": el toast de éxito solo se muestra si la respuesta trae folio/UUID fiscal. Si no, toast de error con el motivo real y la factura se queda visiblemente en "Por timbrar".

## 2. P1-1 · Vacíos silenciosos en listas, KPIs y saldos

- Diagnóstico primero: comparar el `organization_id` del contexto de usuario contra el de las filas en embarques, cotizaciones, pagos y CxP, y revisar si el RPC devuelve `total_count` con org distinta.
- Endurecer: ninguna pantalla debe mostrar "sin datos" cuando la consulta falló. Las tablas ya soportan estado de error (`isError` en `DataTable`); se propaga el error de cada lista/KPI afectado y se agrega reintento.
- Si la organización del contexto difiere de la de los datos, mostrar un aviso "Estás viendo la organización X" en lugar de una lista vacía.
- Dashboard de Operaciones: el bucket "Cerrado" debe contar únicamente `estado = 'Cerrado'`; `Por liquidar` se cuenta aparte (ya existe el contador, se revisa el que alimenta la tarjeta).

## 3. P2-2 · "Registrar pago" en facturas ya pagadas

Hoy el botón depende de `saldo > 0`. Se agrega el estado a la condición: no se ofrece cuando la factura está `Pagada` o `Cancelada`, aunque el saldo venga desfasado por caché. Defensa en profundidad: validación en base que rechace pagos que excedan el saldo.

## 4. P2-6 · Bitácora de pagos

Los pagos a proveedor y a cliente ya registran actividad. Se verifica de punta a punta que el evento aparezca en la bitácora del embarque y del proveedor con monto, referencia y cuenta; si falta algún camino (pago en lote, conciliación bancaria), se agrega ahí el registro.

## 5. P2-7 · Menores

- Backfill de `proveedor_nombre` vacío en facturas creadas por RPC/seed y trigger que lo rellene a futuro.
- Envoltura amigable para errores de infraestructura (Cloudflare 1033/530, mensajes crudos de la capa de datos) en lugar de texto técnico.
- Coherencia de KPIs de CxP: folio proveedor vs folio interno en las mismas columnas, "Por vencer 5d" consistente y el flujo a 90 días considerando facturas sin fecha de vencimiento.
- Totales del perfil de proveedor (se resuelven con el punto 2; se verifica al final).
- Búsqueda global: ya indexa embarques por expediente, BL master y BL house; solo se verifica.

## Detalles técnicos

- Archivos principales: `src/features/facturacion/services/detail.ts`, hook de timbrado, `src/features/embarques/services/queries/paginados.ts`, `src/features/dashboard/services/embarquesPendientesAdmin.ts`, `src/features/cxp/components/DialogDetallePagosProveedor.flags.ts`, servicios de KPIs de CxP.
- Migraciones: constraint/validación de pago vs saldo, backfill + trigger de `proveedor_nombre`. Cada tabla o función nueva con sus permisos explícitos.
- Tests: unitarios para el bucket del dashboard, banderas de pago, resolución de proforma sin embed y el mapeo de errores de infraestructura.
- Al cerrar: entrada en `CHANGELOG.md` y bump de `APP_VERSION`.

## Orden

P1-2 → P1-1 (diagnóstico + hardening) → P2-2 → P2-6 → P2-7.
