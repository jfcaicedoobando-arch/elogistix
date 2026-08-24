# FIX3 · Consistencia de base de datos — validación del parche

Revisé el parche `fix3-db-consistencia.diff` contra la base de datos real. **Los 8 hallazgos son bugs reales**, ninguno es falso positivo. Analogía: son ocho candados que están puestos en la puerta principal pero olvidados en la puerta de servicio.

## Hallazgos confirmados

1. **M-4 · Pagos con fecha manipulable** — El guard `assert_factura_viva_para_pago()` sólo valida "fecha futura" cuando se crea el pago (`INSERT`). Al editar (`UPDATE`) la fecha se cuela, y la lista de "sólo metadatos" no incluye `fecha_pago`, así que el cambio pasa sin dejar rastro. Falta además rechazar pagos con fecha anterior a la emisión de la factura.
2. **Fugas de lectura entre organizaciones** — `venta_embarque_mxn_neta`, `nc_aplicadas_en_moneda_factura` y `comision_embarques_de_factura` son `SECURITY DEFINER`, sin filtro de organización, y con permiso de ejecución para cualquier usuario autenticado: funcionan como oráculos de datos de otros tenants.
3. **Portal de proformas sin límite de peticiones** — Confirmado: de las 4 funciones públicas que recibieron `check_ratelimit`, hoy `portal_obtener_proforma_por_token` es la única que lo perdió (y quedó `STABLE`, lo que impide escribir el contador). Las otras tres lo conservan.
4. **Cotización de otra organización ligada a un embarque** — El trigger de vínculo cotización↔embarque no valida que ambas pertenezcan a la misma organización.
5. **Comisiones no se recalculan al borrar una NC** — El trigger de comisiones de notas de crédito escucha `estado` y `monto`, pero no `deleted_at` (su trigger hermano de estado de factura sí lo escucha).
6. **Sin rastro de última modificación en 10 tablas** — Verificado: `conceptos_venta`, `conceptos_costo`, `conceptos_factura`, `contactos_cliente`, `documentos_embarque`, `eventos_embarque`, `notas_embarque`, `proforma_conceptos_consolidados`, `proveedor_facturas_conceptos` y `crm_notificaciones` no tienen columna `updated_at` ni su trigger.
7. **Errores de permiso mal tipificados en CRM** — `crm_propagar_conversion_cliente` lanza `LC_NO_AUTENTICADO`, `LC_SIN_PERMISO`, `LC_ORG_AJENA` sin código `42501`, por lo que la app no puede distinguir "no tienes permiso" de un error genérico.
8. **BUG-18 · Metadatos fiscales del alta inicial sin verificar** — Confirmado en `facturasEntrantesUpload.ts`: el alta inicial del buzón inserta UUID fiscal, RFC, folio, fecha, total y moneda **parseados en el navegador**. Sólo el flujo de "adjuntar XML posterior" pasa por la función de servidor que re-parsea y compara.

## Qué se implementará

Ocho migraciones de base de datos, en este orden:

- Guard de pagos extendido a edición + regla de fecha previa a la emisión.
- Revocar el acceso de usuarios autenticados a las tres funciones auxiliares financieras.
- Restaurar el límite de peticiones (30/min) en la consulta pública de proformas.
- Validar misma organización en el vínculo cotización↔embarque.
- Añadir `deleted_at` al disparador de recálculo de comisiones por nota de crédito.
- Añadir columna y trigger `updated_at` a las 10 tablas listadas (cambio de sólo metadatos, sin reescritura de tablas).
- Propagar `ERRCODE 42501` en los errores de permiso del CRM.
- BUG-18: nueva bandera `metadatos_verificados` que sólo puede sellarse desde la función de servidor que re-parsea el XML; cualquier otra vía la deja en `false`.

Cierre: actualizar el manifiesto de migraciones, `CHANGELOG.md` y `APP_VERSION` a `13.736.0`.

## Detalles técnicos

- Se reutilizan los espejos canónicos en `supabase/schema/` que el parche actualiza (`cxp/adjuntar_xml_entrante_verificado.sql`, `cxp/adjuntar_xml_factura_entrante.sql`).
- El sello de BUG-18 usa una GUC transaccional (`app.entrante_xml_verificado`) levantada por la RPC verificada y leída por un trigger `BEFORE INSERT OR UPDATE`.
- `REVOKE EXECUTE ... FROM authenticated` sobre `adjuntar_xml_factura_entrante` ya está aplicado en la base actual; se re-aplica como defensa contra re-aplicaciones de espejos viejos.
- Residual documentado: los metadatos capturados en el navegador siguen visibles en la fila hasta que el servidor los confirma; los flujos de captura deberían exigir `metadatos_verificados = true` en una tanda posterior.
