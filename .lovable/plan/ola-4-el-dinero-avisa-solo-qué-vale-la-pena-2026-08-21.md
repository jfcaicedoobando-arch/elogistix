# Ola 4 — "El dinero avisa solo": qué vale la pena

Verifiqué los 8 puntos contra el código vivo. Resumen: los cimientos (tabla de notificaciones, plantillas de correo, RPCs de embarque y proforma, validador fiscal) ya existen; lo que falta es el cableado. Por eso varias piezas son baratas y otras son riesgo puro.

## Vale la pena ahora (hacer en esta ola)

**O4.1 — Notificaciones de eventos de dinero.** Confirmado: `notificaciones_internas` existe desde hace meses y decenas de flujos ya insertan ahí, pero `pagos_factura` sólo tiene el trigger de comisión (`trg_pago_factura_comision_ins`) y `facturas` sólo el de `updated_at`. Nadie se entera in-app de un pago recibido ni de un timbrado. Es el mayor valor por esfuerzo de toda la ola.

**O4.6 — Pre-flight fiscal temprano.** Confirmado: `buildChecksTimbrado` ya existe (`src/features/facturacion/utils/validarDatosTimbrado.ts`) y las columnas `forma_pago_default` / `metodo_pago_default` ya existen en `clientes`, pero sólo se capturan dentro del diálogo de timbrado. Mover esa validación al alta del cliente y a las bandejas es puro front + un select: elimina el ciclo "intentar timbrar → fallar → pedir datos".

**O4.5 (a) — Bandeja "Aceptadas sin embarque".** Confirmado: no existe ningún filtro de cotizaciones aceptadas sin embarque; `fetchCotizacionesAceptadas` sólo filtra por estado. Es una query y una pestaña. La parte (b), crear el embarque automáticamente al aceptar en el portal, la dejaría apagada por defecto o fuera de esta ola.

**O4.8 — Avisos de fechas al operador.** Confirmado: `dashboardOperador.ts` ya tiene los umbrales (7 días sin tracking, 2 días pre-arribo) pero sólo se leen cuando alguien abre el dashboard; no hay ningún job que avise. Reutilizar esos umbrales en un cron diario es barato y es el aviso que más pide operaciones.

## Vale la pena, pero con freno de mano

**O4.4 — Cadencia automática de cobranza.** Confirmado el diagnóstico: `cxc-recordatorios` se declara "stub" en su propia cabecera y no envía nada; el envío real hoy es 1 a 1 vía `cxc-recordatorio-enviar`. La tabla `factura_recordatorios` y la plantilla `recordatorio-cobranza` ya existen, así que técnicamente falta poco. Pero es lo único de la ola que le escribe a clientes reales sin que nadie apriete un botón: va con interruptor por organización apagado por defecto, tope de 1 recordatorio por ventana y prueba en una sola org antes de generalizar.

## No lo haría en esta ola

**O4.2 — Acuses al portal del cliente.** `notificaciones_cliente` ya recibe avisos vía trigger de base de datos cuando se envía una cotización. Meter inserciones también desde las edge functions de correo duplica la fuente de verdad y arriesga avisos dobles. Si se hace, debe ser en el trigger, no en la edge.

**O4.3 — Activar email transaccional.** La plantilla `cotizacion-respuesta` ya está registrada en el registry y hay una función activa que la usa. El "TODO Fase 2.1" que cita el documento sólo aparece en documentación, no en un archivo fuente vivo. Antes de tocar nada hay que confirmar qué falta realmente: puede que ya esté hecho.

**O4.7 — Proforma automática al entregar.** Crear documentos financieros solos, sin que el contador lo pida, es el cambio con más potencial de ensuciar datos. Si entra, sólo como notificación accionable ("Generar proforma"), nunca como creación automática — y después de que O4.1 esté probado.

## Sobre el diff adjunto

El `ola-4.diff` trae 22 archivos, incluidas 5 migraciones nuevas y cambios simultáneos a 5 edge functions. No lo aplicaría de un jalón: mezcla lo barato y verificado (selects SAT, badge de pre-flight, bandeja de cotizaciones) con lo riesgoso (cadencia de cobranza, auto-creación de embarque, proforma automática) en un solo golpe, y las migraciones son irreversibles. También referencia archivos que hoy no existen (`PreflightFiscalBadge.tsx`) y hay que comparar cada cuerpo SQL contra `supabase/schema/` antes de aplicarlo, como pide el propio documento.

Propuesta: partirlo en 3 entregas.

```text
Entrega 1 (bajo riesgo)   O4.6 + O4.5(a)         sólo front + 1 columna de captura
Entrega 2 (medio)         O4.1 + O4.8            triggers y cron de avisos internos
Entrega 3 (alto, piloto)  O4.4                   correo a clientes, apagado por defecto
```

## Notas técnicas

- Cada trigger nuevo se emite con `SECURITY DEFINER SET search_path TO 'public'`, dedupe por (evento, entidad, día) y su prueba de regresión en `supabase/tests/` en la misma entrega.
- Los avisos por ETA/ETD reutilizan los umbrales de `dashboardOperador.ts` en vez de duplicar constantes.
- `estadoVigencia` vive en el dominio de expediente/proveedor, no en embarques; para fechas de embarque se calcula con las funciones de fecha ya centralizadas, no reutilizando esa función.
- Las 5 migraciones del diff se re-emiten con timestamps nuevos por entrega, con GRANT/REVOKE explícitos para no reabrir hallazgos H6.
- `CHANGELOG.md` y bump de `APP_VERSION` por entrega.
