# Factura FP-000256: el IVA fantasma de 50 USD

## Qué encontré (verificado en la base)

La factura `FP-000256` (folio del proveedor `034G545923`, WAN HAI, USD) quedó así:

- Renglones del documento: `ISPS (per container)` 5 × 12 USD = **60 USD**, IVA de renglones **0**.
- Encabezado: subtotal **60**, IVA **50**, retenciones 0 → total **110 USD**.
- Al subirla al buzón, operaciones declaró **60 USD**.
- No tiene pagos y sigue **pendiente de aprobación**.
- El ajuste fantasma de −953.68 USD del embarque 0358 ya está eliminado; no hay que volver a tocarlo.

El total no se captura a mano: se calcula como subtotal + IVA + IEPS − retenciones. O sea, los 60 USD de conceptos están bien y el error entero está en el campo **IVA = 50**, que se quedó en el encabezado (viene de la lectura del PDF, que reporta un "tax_total") y nadie lo volvió a revisar cuando se corrigieron los renglones.

Analogía: los renglones del recibo suman 60, pero en la casilla de "impuesto" quedó anotado un 50 de otra hoja; la suma final sale 110 aunque ningún renglón lo respalde.

## Por qué nadie lo detuvo

Hay tres puntos donde debió avisar y no lo hizo:

1. Al guardar sólo se compara el **subtotal** contra la suma de renglones (60 vs 60: cuadra). El IVA del encabezado nunca se compara contra el IVA de los renglones.
2. El aviso de "operaciones declaró 60" es informativo y no bloquea.
3. La validación de aprobación en base también revisa únicamente subtotal vs renglones, así que la factura se podría aprobar y pagar por 110 USD.

## Qué propongo hacer

### 1. Corregir la factura FP-000256
Dejar IVA en 0 y, por consecuencia, total en 60 USD. Subtotal, renglones, proveedor, embarque, fechas y folio no se tocan. Queda registrado en la bitácora de la factura como corrección de captura. Es seguro porque no tiene pagos ni está aprobada.

### 2. Impedir que se repita (sin agregar módulos nuevos)
- **Al capturar:** si el documento trae renglones, el IVA (e IEPS) del encabezado debe coincidir con lo que suman los renglones. Si no coincide, se marca el campo en rojo con el detalle ("los renglones suman 0 de IVA y capturaste 50") y no deja guardar. Hoy sólo se pinta un aviso amarillo.
- **Al aprobar:** misma regla en la base de datos, como red de seguridad para facturas capturadas antes del cambio o desde otra ruta.

### 3. Revisar si hay más facturas así
Consulta puntual de facturas vivas cuyo IVA del encabezado no cuadre con el IVA de sus renglones, para reportártelas antes de corregir nada. No se corrige en automático.

## Detalles técnicos

- Corrección de datos: `UPDATE` acotado a `proveedor_facturas` (`iva = 0`, `total = 60`) para ese `id`, más registro en `bitacora_actividad`.
- Frontend: nueva validación en `useNuevaFacturaProveedorForm.schema.ts` (o su capa de derivados) que recibe la suma de IVA/IEPS de `cfdiConceptos` y emite issue en los campos `iva`/`ieps`; el candado se suma a `puedeContinuarSubmit`. Sin cambios en cálculo de totales ni en el parser.
- Base: extender `_cxp_validar_aprobacion` con `LC_CXP_DESCUADRE_IVA` comparando `proveedor_facturas.iva/ieps` contra `SUM` de las líneas fiscales (`concepto_costo_id IS NULL`), tolerancia de un centavo, sólo cuando existan líneas fiscales. Migración + espejo en `supabase/schema/cxp/_cxp_validar_aprobacion.sql`.
- Pruebas focalizadas de la nueva validación, `CHANGELOG.md` + `APP_VERSION`, `audit:manifest` y `db:postcheck`. CI, RLS y E2E completos quedan a GitHub Actions.

## Supuesto a confirmar
Asumo que la factura de WAN HAI **no lleva IVA** (60 USD netos, como declaró operaciones). Si en realidad sí traía un impuesto, dime el importe correcto y lo ajusto en lugar de dejarlo en 0.
