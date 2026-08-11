# Robustecer la subida de facturas de proveedor al buzón

## Diagnóstico

Hoy el modal "Subir factura de proveedor al buzón" (dentro del expediente) captura: archivos PDF/XML, proveedor, monto declarado con cotejo contra lo costeado y una nota. Lo que **no** se aprovecha es lo que el operador sí sabe: **a qué concepto de costo del embarque corresponde el documento**. Esa información se vuelve a adivinar después, en el modal de captura de contabilidad, donde se eligen los `conceptos_costo` abiertos del proveedor.

Resultado: el operador tiene el dato en la mano y no lo deja registrado; contabilidad lo reconstruye a ciegas.

## Qué se construye

### 1. Selección de conceptos de costo en la subida

Nueva sección en el modal, debajo de "Proveedor" (aparece sólo cuando ya hay proveedor elegido):

```text
Conceptos de este embarque que cubre la factura
[x] Flete marítimo CN→MZN      Costeado: 1,000.00 USD
[ ] THC destino                Costeado:   180.00 USD
[ ] Este documento no corresponde a un costo ya capturado
```

- Lista los `conceptos_costo` abiertos **de ese proveedor en ese embarque** (misma fuente que usa contabilidad).
- Al marcar, el importe sugerido se prellena con el costeado y es editable.
- Suma de lo marcado se muestra junto al **monto declarado**, con el mismo semáforo que ya existe (verde si coincide dentro de ±1% o ±$1, ámbar si difiere).
- "Sugerencia obligatoria, no bloqueante": el botón "Enviar al buzón" exige marcar al menos un concepto **o** activar la casilla "no corresponde a un costo ya capturado". Nunca se valida contra montos: si difiere, sólo avisa.
- Si el proveedor no tiene conceptos abiertos en el embarque, se muestra un mensaje neutro y la casilla de "sin costo capturado" queda marcada por defecto.

### 2. La sugerencia llega a contabilidad

- Los conceptos marcados se guardan con el documento del buzón.
- En el **buzón** cada fila muestra un chip con los conceptos sugeridos (p. ej. "Flete marítimo +1") y el semáforo de monto.
- Al abrir "Capturar factura de proveedor" desde el buzón, la sección "Vincular a embarque" llega **pre-marcada** con esos conceptos y sus importes; contabilidad puede desmarcar o cambiar libremente (no bloqueante).
- Si un concepto sugerido ya fue cubierto por otra factura, se muestra en gris con la leyenda "ya facturado" y no se pre-marca.

### 3. Pulido del paso de subida

- El aviso "sin XML sólo puede capturarse como factura extranjera" se conecta con el origen del proveedor: si el proveedor elegido es Nacional y falta XML, el aviso sube a advertencia visible; si es extranjero, desaparece.
- Resumen final antes de enviar: proveedor · monto · conceptos marcados · archivos adjuntos, en una línea compacta arriba del botón, para que el operador confirme de un vistazo.
- Se mantiene todo lo demás igual (zona única de carga, chips, datos detectados del CFDI, nota colapsada).

No se agrega punto de entrada desde el buzón: la subida sigue siendo desde el expediente.

## Detalles técnicos

- **Migración**: tabla hija `public.embarque_facturas_entrantes_conceptos` (`entrante_id` FK cascade, `concepto_costo_id` FK, `monto_sugerido numeric`, `organization_id`, timestamps + trigger `updated_at`), con `GRANT` a `authenticated`/`service_role`, RLS por organización espejo de `embarque_facturas_entrantes`, y unique (`entrante_id`, `concepto_costo_id`). Adicionalmente `sin_costo_capturado boolean not null default false` en `embarque_facturas_entrantes`.
- **Servicios**: `SubirFacturaEntranteInput` acepta `conceptosSugeridos: {conceptoId, monto}[]` y `sinCostoCapturado`; la inserción de las filas hijas ocurre tras insertar el documento (RPC nueva `subir_entrante_con_conceptos` para atomicidad, o inserción secuencial con rollback best-effort — se prefiere RPC). `SELECT_COLS_ENTRANTES` expone la relación embebida.
- **Hooks**: nuevo `useConceptosCostoEmbarqueProveedor(embarqueId, proveedorId)` reutilizando el servicio de conceptos abiertos filtrado por embarque; `useSubirEntranteForm` gana estado `conceptosSeleccionados` / `sinCostoCapturado` y la regla de `listo`.
- **Componentes nuevos** (≤200 líneas, `FormDialogSection`): `ConceptosSugeridosEntrante.tsx`, `ResumenSubidaEntrante.tsx`. `VerificacionMontoEntrante.tsx` recibe la suma sugerida.
- **Captura**: `useCapturaEntranteWiring` / `EntranteParaCaptura` transportan los conceptos sugeridos y los pre-marcan en `VincularEmbarqueSection` filtrando los ya cubiertos (`costosConFactura`).
- **Tests**: reglas de `listo` (conceptos vs casilla), comparador monto declarado vs suma sugerida, pre-marcado en captura ignorando conceptos ya facturados, y test SQL de RLS cross-org de la tabla hija.
- Sin colores hardcodeados; tokens `success` / `warning` / `muted`.
- `CHANGELOG.md` + `APP_VERSION` → 13.506.0.
