# Bloque Q — Separación de roles del ciclo financiero del embarque

Replantear Bloque Q para que **cada rol vea sólo lo suyo** y trabaje desde bandejas dedicadas, sin sobrecargar al operador. El detalle del embarque deja de ser el lugar único de acción: pasa a ser el "tablero de estado" y las acciones financieras se mueven a módulos por rol.

## Modelo de responsabilidades

| Etapa | Responsable | Dónde trabaja |
|---|---|---|
| Cotizar y cerrar venta | `vendedor` / `gerente_comercial` | Módulo CRM + Cotizaciones (ya existe) |
| Ejecutar embarque, tracking, docs | `coordinador_logistico` / `operador` | Detalle del embarque (operativo) |
| Capturar facturas de proveedor | `auxiliar_contable` (nuevo) | **Bandeja CxP** + detalle del proveedor |
| Pagar a proveedores | `tesorero` | **Bandeja CxP – Por pagar** |
| Emitir/timbrar factura a cliente | `contador` | **Bandeja Por facturar** |
| Seguimiento de cartera y cobranza | `ejecutivo_cobranza` (nuevo) | **Bandeja Cartera** |
| Aprobar notas de crédito y cierres | `contador` / `admin_org` | Bandejas correspondientes |

## Cambios de roles

### Nuevos roles en `app_role` enum
- `auxiliar_contable` — captura facturas de proveedor, concilia con costos del embarque, sube XML/PDF; NO ejecuta pagos.
- `ejecutivo_cobranza` — ve sólo facturas emitidas con saldo, registra promesas de pago, envía recordatorios, marca cobros recibidos; NO emite facturas ni edita costos.

### Ajustes a `usePermissions` y `roleHierarchy`
- `canEmitirFactura` → `contador`, `admin_org`, `super_admin`.
- `canCapturarFacturaProveedor` → `auxiliar_contable`, `contador`, `admin_org`, `super_admin`.
- `canPagarProveedor` → `tesorero`, `admin_org`, `super_admin`.
- `canRegistrarCobro` → `ejecutivo_cobranza`, `contador`, `admin_org`, `super_admin`.
- `canViewMontosEmbarque` (operador) → `coordinador_logistico`, `operador` lo recuperan **solo lectura** (sin acciones).
- Actualizar `ROLE_LABELS`, `ROLE_DESCRIPTIONS`, `ASSIGNABLE_ROLES_ADMIN_ORG`, `roleCatalog`.

### Sidebar
- Reorganizar menú por rol: Vendedor (CRM), Operador (Embarques/Tracking), Auxiliar (CxP), Tesorero (Pagos), Contador (Por facturar), Cobranza (Cartera).

## Bandejas nuevas

### 1. `/cxp/por-capturar` (auxiliar_contable)
Lista de embarques con costos presupuestados sin factura de proveedor asociada, o XML recibidos sin conciliar. Acciones: subir XML/PDF, ligar a `embarque_id` + `concepto_costo`, validar totales y RFC.

### 2. `/cxp/por-pagar` (tesorero)
Facturas de proveedor `estado='Vigente'` con saldo > 0, agrupadas por proveedor y vencimiento. Acciones: programar pago, registrar pago desde cuenta bancaria, descargar layout BBVA.

### 3. `/facturacion/por-emitir` (contador)
Embarques con proforma aprobada y sin factura emitida, o con diferencia entre proforma y factura. Acciones: revisar, timbrar (reusa `DialogTimbrarFactura`), cancelar.

### 4. `/cartera` (ejecutivo_cobranza)
Facturas emitidas con saldo, ordenadas por `dias_vencido` desc. Columnas: cliente, folio, total, pagado, saldo, días vencido, último contacto. Acciones: registrar pago, enviar recordatorio (reusa templates), agregar nota de seguimiento, marcar promesa de pago.

Cada bandeja:
- Tabla server-paginated con filtro por cliente/proveedor/estado/fecha.
- Tarjetas KPI arriba (total saldo, vencido, en periodo, etc.).
- Drill-down al detalle del embarque (solo lectura financiera para los que no son dueños del paso).

## Detalle del embarque — modo "tablero"

- **Operador** ve nueva sección colapsable **"Estado financiero"** con:
  - Semáforo Costo (Capturado/Pendiente/Pagado).
  - Semáforo Facturación cliente (Sin proforma/Proforma lista/Facturada/Cobrada).
  - Tarjeta P&L (presupuestado vs real, ya existe en `TabPnl`).
  - Sin botones de acción financieros.
- **Contador/auxiliar/tesorero/cobranza** ven los mismos datos **más** sus acciones (botones condicionados por permiso). No se crean tabs nuevos para ellos: las acciones siguen viviendo en sus bandejas; el embarque sólo agrega un botón "Ir a CxP/Cartera/Por facturar de este embarque".

## Tablas nuevas

### `cobranza_seguimiento`
- `factura_id` FK, `tipo` (`recordatorio_email`, `llamada`, `promesa_pago`, `nota`), `fecha`, `usuario_id`, `comentario`, `monto_promesa`, `fecha_promesa`.
- RLS: cobranza, contador, admin_org.

### Nuevo campo `proveedor_facturas.estado_captura`
- `pendiente_xml`, `capturada`, `conciliada`, `pagada`. Permite separar "auxiliar terminó captura" de "tesorero pagó".

## RPCs nuevos (todas `SECURITY INVOKER`)

- `cxp_por_capturar(_org)` — embarques con costos sin factura de proveedor.
- `cxp_por_pagar(_org)` — facturas vigentes con saldo, días al vencimiento.
- `facturacion_por_emitir(_org)` — proformas sin factura.
- `cartera_pendiente(_org)` — facturas con saldo, días vencidos, último contacto.
- `embarque_estado_financiero(_embarque_id)` — devuelve 4 semáforos para el tablero del operador.

## Tests
- `usePermissions.test.tsx` — agregar 2 roles nuevos y 4 capacidades nuevas.
- `roleHierarchy.test.ts` — `ejecutivo_cobranza` no satisface `contador`; `auxiliar_contable` no satisface `tesorero`.
- RPC tests (`supabase/tests/rls/`) — cada bandeja con 3 escenarios: vacío, con datos del tenant, sin acceso cross-org.
- E2E nuevo: `08-roles-finanzas.spec.ts` — login como cobranza, ve cartera pero NO ve botón timbrar.

## Changelog & versión
- `APP_VERSION` → `13.54.0`.
- Migración del enum `app_role` (no destructiva, sólo agrega valores).
- Entrada en `CHANGELOG.md` con la nueva matriz de roles.

## Fuera de alcance
- Conciliación bancaria BBVA automática (ya existe en otro módulo).
- Bloque R (seguros) y Bloque S (cierre financiero).
- Importador masivo de XML SAT (Bloque T propuesto).
- Reasignación masiva de usuarios existentes a los nuevos roles (lo hacemos manualmente desde Admin).

## Diagrama de flujo

```text
Vendedor          Operador           Auxiliar         Tesorero         Contador        Cobranza
   |                 |                  |                |                |               |
Cotización →    Embarque ejecuta    Captura XML      Paga proveedor   Timbra factura  Sigue cartera
   |          (tracking + docs)    proveedor           (BBVA)         al cliente      registra pago
   |                 |                  |                |                |               |
   └────── Embarque (tablero solo lectura para todos, acciones por rol) ──────────────────┘
```
