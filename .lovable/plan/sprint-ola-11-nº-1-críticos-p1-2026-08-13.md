# Sprint Ola 11 · Nº 1 — Críticos P1

Revisé los cuatro hallazgos del documento contra el estado actual del proyecto. **Uno ya está corregido**; quedan tres por aplicar.

## Estado verificado

| ID | Hallazgo | Estado actual |
|---|---|---|
| RBD-01 | Folio de traspaso sin privilegios | **Ya corregido**: la función `siguiente_folio_traspaso` existe como SECURITY DEFINER y `registrar_traspaso_bancario` ya la usa; además `authenticated` ya tiene INSERT en la tabla de folios. Sin trabajo pendiente. |
| RFE-01 | Pago en lote CxP en EUR guarda el T/C del dólar | **Pendiente**: el envío usa `tcDof?.usdMxn` sin ramificar por moneda, y si no hay T/C se manda vacío sin avisar. |
| RNF-07 | Se puede auto-aprobar una factura de proveedor sin pasar por la RPC | **Pendiente**: no existe ningún trigger que vigile la columna de aprobación. |
| RUX-01 | El tracking público expone eventos internos y de prueba | **Pendiente**: la función pública devuelve todos los eventos sin filtrar y la línea de tiempo pública los pinta tal cual. |

## Lo que se va a construir

### 1. RFE-01 — T/C correcto en el pago en lote a proveedor
- El lote en EUR guardará la paridad **EUR/MXN** (y el de USD, la de USD), igual que ya hace el cobro en lote de clientes.
- Si no hay tipo de cambio DOF para la fecha, el pago **se bloquea**: el botón queda deshabilitado y aparece un aviso ámbar explicando por qué, en lugar de guardar el pago sin tipo de cambio.
- El texto de ayuda mostrará la moneda y la fecha del DOF usado ("TC DOF EUR 20.0258 (19/07/2026)").

### 2. RNF-07 — Cerrar el bypass de segregación de funciones en CxP
- Nueva regla en la base de datos que impide aprobar o rechazar una factura de proveedor por fuera de la función oficial (que valida rol, evita que quien capturó apruebe y deja bitácora).
- Regresar una factura a "pendiente" tras editarla sigue permitido: es el flujo normal de re-aprobación.

### 3. RUX-01 — Limpiar el tracking público
- La respuesta pública sólo incluirá hitos de negocio (zarpe, transbordo, arribo, descarga, despacho, liberación, en ruta, entrega) y descartará cualquier evento marcado como interno, semilla o de pruebas automatizadas.
- Doble capa: la línea de tiempo pública también aplicará el mismo filtro antes de pintar, para que ningún despliegue intermedio muestre ruido interno.

## Detalles técnicos

- `src/features/cxp/hooks/usePagoLoteState.ts`: derivar `tcAplicable` (EUR → `eurMxn`, resto → `usdMxn`) y `tcBloqueado`; integrar `tcBloqueado` al `error` del lote y enviar `tipo_cambio_usd: tcAplicable`.
- `src/features/cxp/components/DialogPagoLoteDatos.tsx`: ampliar la prop `tcDof` con `eurMxn`, hint con moneda/fecha y alerta ámbar cuando falta el T/C.
- Migración nueva `fix_rnf07_sod_cxp`: función `guard_aprobacion_proveedor_factura` + trigger `BEFORE UPDATE OF estado_aprobacion` que exige la marca de sesión `app.aprobando_cxp`, y `CREATE OR REPLACE` de `aprobar_factura_proveedor` (cuerpo vigente) envolviendo sus UPDATE con `set_config(...)` transaction-local. Se re-aplican REVOKE/GRANT.
- Migración nueva `fix_rux01_tracking_eventos_publicos`: `CREATE OR REPLACE` de `get_tracking_public` con el bloque `v_eventos` filtrado por `tipo::text IN (...)` y `NOT LIKE` de marcas internas sobre `descripcion` y `usuario`; grants canónicos re-aplicados.
- `TrackingPublicoTimeline.tsx`: aplicar `filtrarEventosVisiblesCliente` (helper ya existente, hoy sólo usado en el portal autenticado).
- Pruebas nuevas: cálculo de T/C y bloqueo del lote CxP, y filtro del timeline público. Se corre la suite de CxP y portal, más `audit:migrations`.
- `APP_VERSION` a 13.560.0 y entrada en `CHANGELOG.md`.

## Fuera de alcance

- RBD-01: nada por hacer (ya aplicado en una migración previa).
- No se endurece la política RLS de `proveedor_facturas` (el flujo de edición necesita UPDATE directo); el trigger es la vía de menor impacto.
