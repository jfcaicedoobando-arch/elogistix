# Ola 3 — Controles del ciclo comercial y fiscal

Continúa la remediación de la auditoría 3. Olas 1 (dinero/seguridad) y 2 (aislamiento entre organizaciones) ya están aplicadas.

## Qué verifiqué antes de planear

- **No existe cierre de periodo**: `configuracion_global` tiene 15 claves (branding, sesión, cierre de embarque, conciliación) y ninguna de fecha de cierre contable; no hay función `*periodo*` en la base. Hoy se puede emitir o pagar con fecha retroactiva sin límite.
- **`uuid_fiscal` ya es inmutable desde la aplicación**: el trigger `trg_bloquear_factura_emitida` rechaza cambiar `uuid_fiscal` y `facturapi_id` salvo cuando el rol es el del servicio interno. Queda sólo un hueco fino: el servicio interno podría sobrescribir un UUID ya asignado.
- La cadena de facturación ya tiene candados parciales (`trg_congelar_factura`, `trg_cotizaciones_guard_en_operacion`, `trg_enforce_proforma_aceptada`). Antes de escribir SQL revisaré cuáles casos concretos de la auditoría siguen abiertos y sólo agregaré lo faltante.

## 1. Cierre de periodo contable

- Configuración por organización: fecha de cierre (`cierre_periodo_fecha`) y quién puede reabrir.
- Bloqueo en base de datos: no se puede emitir, cancelar, pagar ni registrar nota de crédito con fecha anterior o igual a la fecha de cierre. Aplica a facturas, pagos de cliente, pagos a proveedor, facturas de proveedor y notas de crédito.
- Error legible `LC_PERIODO_CERRADO` con la fecha, más aviso en la interfaz (banner en Facturación y Tesorería cuando la fecha capturada cae en periodo cerrado).
- Pantalla de configuración para fijar/mover la fecha de cierre, restringida a dirección/contabilidad.

## 2. Cadena cotización → embarque → factura inmutable

- Cotización aceptada o en operación: no editable en importes ni conceptos (sólo versionado).
- Conceptos ya incluidos en una proforma: bloqueados contra edición y borrado.
- Una proforma sólo puede consolidar conceptos de su propio embarque y su propia organización.
- Mensajes claros en la interfaz para cada bloqueo, en lugar del error crudo de base de datos.

## 3. `uuid_fiscal` de una sola escritura

Permitir asignarlo cuando está vacío y rechazar cualquier sobrescritura posterior, incluso desde procesos internos.

## Detalles técnicos

- Una sola migración con `GRANT`/`REVOKE` explícitos y triggers de validación (mismo patrón que la Ola 2).
- Nueva suite `supabase/tests/ola3_controles_ciclo.sql` registrada en `supabase/tests/_guards_manifest.txt`, cubriendo: backdating rechazado, cotización aceptada no editable, concepto proformado bloqueado, consolidación cruzada rechazada y sobrescritura de `uuid_fiscal` rechazada.
- Códigos `LC_PERIODO_CERRADO`, `LC_COTIZACION_INMUTABLE`, `LC_CONCEPTO_PROFORMADO`, `LC_PROFORMA_EMBARQUE_AJENO` traducidos en la capa de mensajes del frontend.
- Sincronizar `supabase/schema/baseline.sql` y el manifiesto de release; `CHANGELOG.md` + `APP_VERSION` → `13.772.0`.

## Fuera de alcance

Ola 4 (bloqueo optimista en formularios financieros restantes y limpieza de código muerto) se entrega después, en su propia versión.
