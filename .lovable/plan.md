# Plan: Fases 3-6 — Flujo Proforma → Factura → Timbrado → Pago → REP

**Contexto:** Fases 1-2 ya entregadas (vista `v_proforma_factura_link`, RPC `convertir_proformas_a_factura`, modal `ConvertirAFacturaDialog`, botón "Convertir a factura" en proforma individual). El timbrado manual de facturas y REP **ya existe** en el código (`useTimbrarFactura`, `useTimbrarRep`, edge functions `facturapi-emitir` y `facturapi-emitir-rep`). Las fases siguientes son **integración + automatización + visibilidad**, no construir desde cero.

## Fase 3 — Conversión múltiple (fusión N:1) desde el listado

Hoy la conversión sólo vive en el detalle de proforma. Para fusionar varias proformas en una factura hay que poder seleccionarlas en el listado.

- En `TabProformas` agregar checkbox por fila (sólo habilitado si `estado_revision = 'aprobada'` y `estado_proforma != 'facturada'`).
- Barra de acción flotante "Convertir N proformas a factura" que aparece al haber selección.
- Validar en cliente antes de abrir el modal: mismo `cliente_id` y misma moneda en todas las seleccionadas (mensaje claro si no).
- Reusar `ConvertirAFacturaDialog` pasando el array de IDs; el RPC ya soporta fusión.

## Fase 4 — Timbrado manual desde la factura recién generada

El componente `DialogTimbrarFactura` ya existe. Falta el hilo de UX desde la conversión.

- Al regresar `convertirProformaAFactura` con éxito, navegar a `/facturacion/{id}` y abrir automáticamente el `DialogTimbrarFactura` (query param `?accion=timbrar`).
- En el detalle de factura mostrar badge "Borrador — pendiente de timbrar" y botón primario "Timbrar ante SAT" (sólo roles `contador`, `admin_org`, `admin`, `super_admin`).
- Tras timbrar exitoso, actualizar la proforma origen: marcar `estado_proforma = 'facturada'` (ya lo hace el RPC al crear la factura; verificar idempotencia).

## Fase 5 — REP automático al registrar pago en facturas PPD

Hoy `useRegistrarPagoFactura` registra el pago en BD pero **no dispara `emitirRep`** automáticamente.

- Modificar `useRegistrarPagoFactura`:
  - Si la factura es PPD y está timbrada, encadenar la llamada a `emitirRep(pagoId)` después del registro.
  - Manejar fallo del REP sin perder el pago: el pago queda registrado, se muestra toast "Pago registrado, REP pendiente — reintentar" con botón.
- En `DialogRegistrarPago` añadir aviso visual cuando la factura es PPD: "Se generará y timbrará automáticamente el REP al guardar".
- Añadir columna/badge en la tabla de pagos: "REP timbrado / REP pendiente / REP con error" con acción de reintentar.

## Fase 6 — Dashboards de seguimiento + documentación

**Dashboard en `/facturacion`:**
- KPI "Proformas pendientes de facturar" (aprobadas sin `factura_id`).
- KPI "Facturas borrador pendientes de timbrar" (timbrado_en IS NULL, estado borrador).
- KPI "Pagos PPD sin REP" (pagos de facturas PPD timbradas sin REP correspondiente).
- Cada KPI navega al listado filtrado.

**Documentación:**
- `docs/flujo-facturacion.md`: diagrama del pipeline Proforma → Factura → Timbrado → Pago → REP con roles y estados.
- Actualizar `CHANGELOG.md` y bump de versión por fase.

## Detalles técnicos

```text
Proforma (aprobada) ─┐
                     ├─► convertir_proformas_a_factura ─► Factura (borrador)
Proforma (aprobada) ─┘                                         │
                                                               ▼
                                                    DialogTimbrarFactura
                                                               │
                                                               ▼
                                                      Factura (timbrada)
                                                          │   │
                                              PUE ────────┘   └──── PPD
                                               │                      │
                                          Pago ✓ fin           Pago + auto-REP
```

**Migraciones SQL nuevas (Fase 5):**
- Trigger opcional en `pagos_factura` que invoca edge function vía `pg_net` para auto-REP (alternativa al encadenamiento client-side). Decisión preferida: **client-side** para mantener visibilidad del error al usuario.

**Permisos:** todas las acciones nuevas restringidas a `contador`, `admin_org`, `admin`, `super_admin` (consistente con Fase 2).

**Sin notificaciones por email** al cliente tras timbrado (confirmado por usuario).

**Orden sugerido de ejecución:** Fase 3 → Fase 4 → Fase 5 → Fase 6. Cada fase es desplegable independientemente con su propio bump de versión.
