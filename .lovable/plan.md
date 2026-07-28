
# Auditoría visual — Detalle de proforma (`/proformas/:id`)

Capturé la vista real (PRO-2026-1002) y verifiqué los datos en la base. Resumen: la página funciona, pero apila 6 tarjetas a todo lo ancho con baja densidad, repite el mismo dato hasta 3 veces y muestra 3 campos que **no vienen de la base** (uno de ellos es informativo-falso).

## 1. Información repetida (verificada en pantalla)

| Dato | Dónde se repite |
|---|---|
| Total (USD 406.00) | Header + tarjeta "Totales" + "Monto" de la factura asociada |
| Estado "Facturada" | Badge del header + hito del Historial + tarjeta Factura asociada |
| Cliente (FASTCOLD TECH) | Subtítulo del header + tarjeta "Facturar a" |
| Fecha de emisión + ejecutivo | Tarjeta "Datos generales" + hito "Emitida" del Historial |
| Moneda (USD) | En cada celda de la tabla de conceptos, más el encabezado de Totales |

## 2. Información que no se propaga (verificada en base de datos)

- **"Método de pago: Transferencia electrónica"** está escrito a mano en el código (`ProformaDatosGeneralesCard`). No existe columna de método/forma de pago en `proformas` ni en `clientes`. Hoy es un dato inventado en pantalla.
- **"Vigencia"** se calcula siempre como emisión + 30 días (`vigenciaPlus30`), sin campo ni configuración detrás.
- **"Días crédito: —"**: `proformas.dias_credito` viene nulo, pero `clientes.dias_credito` sí existe y no se hereda ni se muestra. Riesgo real: al convertir a factura se usa `proforma.dias_credito ?? 0`, es decir, crédito 0 aunque el cliente tenga plazo pactado.
- **Historial "Enviada —"**: sólo lee `proformas.enviada_at`; nunca consulta `proforma_envios` (esta proforma tiene 0 envíos, pero cuando los hay no se ven fecha, destinatarios ni reenvíos).
- **Sin bitácora**: el detalle de Factura sí tiene `FacturaBitacoraCard`; la proforma no muestra su historial de actividad.
- **Sin liga al portal del cliente**: el enlace público sólo aparece justo después de enviar; no hay "copiar liga" ni "ver como cliente" en la página.
- **Cards sin navegación**: "Facturar a" no enlaza al cliente y "Datos del embarque" no enlaza al embarque (el enlace está escondido en "Más acciones").

## 3. UI/UX y consistencia con el design language

- La página es una columna de 6 tarjetas: en escritorio (1280–1920px) se desperdicia la mitad del ancho y obliga a hacer scroll para llegar a la factura asociada.
- "Totales" ocupa una tarjeta completa para 3 renglones; en Factura, los totales viven **dentro** de la tabla de conceptos (`FacturaConceptosTable`). Divergencia de patrón.
- "Facturar a" queda con un hueco vertical grande porque se estira a la altura de la tarjeta del embarque.
- El Historial son 4 iconos sueltos sin conector; se lee como una fila de tarjetas, no como una línea de tiempo.
- La tabla de conceptos repite la moneda en cada celda y muestra IVA como texto "Sí" en lugar de badge.

## 4. Plan de cambios

### Fase A — Corrección de datos (lo más importante)
1. Quitar "Método de pago" fijo. Se elimina el campo hasta que exista dato real (o se muestra sólo si el CFDI asociado lo tiene).
2. Etiquetar "Vigencia" como derivada (tooltip "30 días naturales desde la emisión") para que no se lea como un campo capturado.
3. Días de crédito: si la proforma no trae plazo, mostrar el del cliente con el badge `HeredadoBadge` ("Heredado del cliente: 30 días") y usar ese mismo valor en la conversión a factura, en lugar de 0.
4. Historial: leer `proforma_envios` para el hito "Enviada" (fecha del último envío, número de envíos y destinatarios en tooltip).

### Fase B — Deduplicación
5. Quitar la tarjeta "Totales" independiente y mover el desglose Subtotal/IVA/Total al pie de la tabla de Conceptos, igual que en Factura. El total grande del header se conserva como única cifra destacada.
6. Quitar de "Datos generales" la fecha de emisión y el ejecutivo (ya viven en el Historial), dejando esa tarjeta para vigencia, crédito, BL Master y folio externo.
7. La tarjeta de factura asociada deja de repetir el monto cuando coincide con el total de la proforma; muestra folio, estado, UUID y descargas.
8. Mover la moneda de cada celda al encabezado de columna ("Importe (USD)") y usar badge para IVA.

### Fase C — Layout y jerarquía
9. Rejilla de dos columnas en escritorio: izquierda (Historial, Conceptos + totales, Notas), derecha en columna angosta y pegajosa (Facturar a, Datos del embarque, Factura asociada, Datos generales). En móvil se apila igual que hoy.
10. Historial convertido en línea de tiempo con conector, mismo lenguaje visual que el timeline de embarques; los hitos sin fecha en gris apagado.
11. Enlaces contextuales: nombre del cliente → ficha de cliente; expediente del embarque → detalle del embarque.
12. Añadir a la barra de acciones "Copiar liga del portal" y "Ver como cliente" (reutilizando el token del portal ya existente).
13. Añadir tarjeta de bitácora al final, con el componente compartido ya usado en Factura.

### Fase D — Verificación
14. Capturas comparativas a 1920×1080, 1440 y 390 (móvil) antes/después.
15. Pruebas: unitarias para la herencia de días de crédito y para el hito "Enviada" con y sin envíos; RTL para que no se rendericen campos inventados; correr lint y la suite afectada.
16. `CHANGELOG.md` + `APP_VERSION` (13.322.0, por el cambio de estructura).

## Detalles técnicos

- Archivos: `routes/ProformaDetalle.tsx`, `components/detalle/*`, `components/ProformaDetalleCards.tsx`, `domain/proformaDetalleHelpers.ts`, `hooks/useProformaDetalle.ts` (agregar envíos y `clientes.dias_credito` al fetch), `components/AccionesProforma.tsx`.
- Sin cambios de esquema en base de datos; sólo lectura adicional de `proforma_envios` y del plazo del cliente en el `select` existente.
- Se respetan los límites de 200 líneas por componente y los tokens semánticos de color (sin colores fijos).
