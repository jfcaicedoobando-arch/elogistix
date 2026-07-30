# Capturar la factura de proveedor directamente desde el buzón

Hoy el contador tiene que hacer el trabajo dos veces: revisa el documento en `/compras/buzon`, se va al embarque, abre "Nueva factura de proveedor", vuelve a arrastrar el XML/PDF y captura todo a mano; al final regresa al buzón a marcar el documento como capturado. El RPC `capturar_factura_entrante` sólo vincula un documento con una factura que ya existe: no crea nada.

La propuesta es un botón **"Capturar factura"** en el buzón que abra el formulario de factura de proveedor ya precargado con el documento (XML o PDF), con puertas de validación en cada paso y que al guardar cierre el ciclo solo.

## Flujo propuesto (con puertas de validación)

```text
Buzón → [Capturar factura]
  │
  ├─ Paso 1 · Precarga automática
  │    XML del CFDI  → parseo fiscal (proveedor, folio, fechas, conceptos, IVA, retenciones)
  │    Sólo PDF      → extracción con IA (proveedor extranjero)
  │    Embarque del documento queda pre-vinculado
  │
  ├─ Puerta A · Proveedor
  │    RFC del XML debe coincidir con un proveedor de la organización.
  │    Si no existe → "Crear proveedor desde CFDI" (ya existe ese diálogo).
  │    Si el documento traía otro proveedor asignado → aviso de discrepancia.
  │
  ├─ Puerta B · Duplicados
  │    UUID fiscal ya capturado → alerta bloqueante con enlace a la factura existente
  │    y opción de "vincular a esa factura" en lugar de crear otra.
  │
  ├─ Puerta C · Cuadre fiscal y de conceptos
  │    Subtotal + IVA + IEPS − retenciones = total del XML.
  │    Suma de conceptos = subtotal (barra de cuadre existente).
  │    Total del XML = total detectado en el buzón.
  │    Descuadre → no deja guardar (o pide justificación si es por centavos).
  │
  ├─ Puerta D · Tipo de cambio
  │    Moneda ≠ MXN exige TC; se propone el DOF de la fecha de emisión (ya existe).
  │
  └─ Paso 2 · Guardar (una sola operación)
       Crea la factura de proveedor + conceptos + vínculo al embarque,
       hereda PDF **y XML** del buzón,
       marca el documento como "capturada" y lo vincula a la factura nueva.
       Si algo falla, no queda factura a medias ni documento mal marcado.
```

## Mejoras de productividad para contabilidad

- **Cola de trabajo**: al terminar una captura, el buzón ofrece "Capturar la siguiente" sin volver al listado.
- **Revisión lado a lado**: el PDF sigue visible en la vista previa mientras se captura, para cotejar importes.
- **Semáforo de listo-para-capturar**: cada fila indica si el documento tiene todo lo necesario (XML presente, proveedor identificado, sin duplicado) o qué le falta. Los que están completos se pueden capturar sin tocar un campo.
- **Rechazo con motivo** (ya existe) para lo que no cuadra, en vez de capturarlo mal.
- **Trazabilidad**: la bitácora del embarque registra quién capturó qué documento y a qué factura corresponde.

## Detalle técnico

**Base de datos**
- Ampliar `capturar_factura_entrante` para heredar también `xml_path`/`uuid_fiscal` a `proveedor_facturas` (hoy sólo copia `archivo_pdf_url`), respetando los valores ya presentes en la factura.
- Nueva RPC `capturar_entrante_creando_factura(p_documento_id, p_payload jsonb)` que dentro de una sola transacción: valida rol (contador, auxiliar_contable, admin, super_admin), organización y `estado = 'por_capturar'`; reutiliza la lógica de creación de factura de proveedor con sus conceptos y vínculos; y aplica el cambio de estado. Con `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE` a `authenticated` (regla H6).
- Validación en la RPC de cuadre fiscal y de que el `uuid_fiscal` no exista ya (el índice único de `proveedor_facturas` sigue siendo la red de seguridad).

**Frontend**
- `DialogNuevaFacturaProveedor` acepta una nueva prop opcional `entrante` (documento del buzón). Con ella: pre-vincula el embarque, descarga el XML/PDF desde el bucket `cxp-inbox` y lo pasa por `parseCfdiXml` o `parse-invoice-pdf`, y al guardar usa la RPC transaccional en lugar de la creación normal.
- Nuevo `src/lib/domain/entranteListo.ts`: reglas puras del semáforo (XML presente según origen del proveedor, proveedor identificado, importes detectados, duplicado) para pintar el estado de cada fila y habilitar/deshabilitar el botón.
- Botón **Capturar factura** en `FacturaEntranteRow` y en la vista previa lateral; "Marcar como capturada" se conserva para documentos cuya factura ya existía.
- Encadenado de la cola en `CxpBuzonEntrantes` (siguiente pendiente al cerrar con éxito).
- Invalidación de caché del buzón, de CxP, del embarque y del checklist de cierre.

**Pruebas**
- Unitarias: reglas del semáforo, mapeo documento → valores del formulario, detección de discrepancia de RFC y de total.
- Integración: la RPC rechaza rol inválido, otra organización, documento ya capturado, UUID duplicado y descuadre fiscal.
- E2E: capturar un documento con XML de punta a punta y verificar que el documento queda "capturada" y la factura vinculada al embarque.

Archivos y `APP_VERSION`/`CHANGELOG.md` se actualizan al implementar.

## Fuera de alcance

- Captura masiva de varios documentos en un solo clic (primero conviene que el flujo de uno funcione y sea confiable).
- Programación de pago o aprobación automática: la factura nace en su estado normal y sigue el flujo de aprobación actual.
