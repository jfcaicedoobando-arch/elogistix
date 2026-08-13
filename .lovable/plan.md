# Conciliación HK LS LIMITED — Estado de cuenta del proveedor vs. ERP

## Resultado del análisis (ya realizado, sin cambios en datos)

Comparé las 36 facturas del estado de cuenta (EDC) del 11/08 contra las 37 facturas
cargadas en el ERP para HK LS LIMITED (todo en USD), cruzando por número de factura
(DEBIT…/NQDEC…).

| Concepto | Facturas | USD |
|---|---|---|
| EDC del proveedor (lo que él dice que le debemos) | 36 | 404,568.00 |
| ERP: total cargado histórico | 37 | 470,778.60 |
| ERP: saldo pendiente actual | 25 | 335,089.60 |
| **Coinciden EDC ↔ ERP (mismo folio, mismo importe)** | **19** | **232,265.00** |
| Están en el EDC y **faltan** en el ERP | 17 | 172,303.00 |
| Tienen saldo en el ERP pero **no** aparecen en el EDC | 12 | 102,824.60 |

Hallazgos clave:

1. **Cero diferencias de importe** en las 19 facturas que coinciden: el costeo del ERP
   cuadra centavo a centavo con lo que factura el proveedor.
2. **Ninguna factura pagada en el ERP sigue apareciendo en el EDC** (los 6 pagos
   registrados, 135,689 USD entre 06/07 y 10/08, están correctamente acreditados por el
   proveedor).
3. **Faltan capturar 17 facturas (172,303 USD)**, con ATD entre 27/06 y 09/08. La mayoría
   traen la referencia del cliente (01249IMRMA, 01267IMRMA…) y sólo 3 traen expediente
   (ELIMP00328, ELIMP00329, ELIMP20267). Son subvaluación del pasivo: el ERP muestra
   menos deuda de la real.
4. **12 facturas viejas con saldo en el ERP (102,824.60 USD) que el proveedor ya no
   reclama** (ELIMP00193, 00195, 00205, 00207, 00210, 00219, 00235, 00242, 00245, 00252,
   00256, 00281; mayo–junio). Casos posibles: pagos hechos y no registrados en el ERP,
   notas de crédito no aplicadas, o facturas duplicadas/reemplazadas por el proveedor.
   Esto es sobrevaluación del pasivo.

Diferencia neta: el ERP reporta 335,089.60 USD y el proveedor 404,568.00 USD →
**69,478.60 USD de más en el EDC**, explicada exactamente por 172,303.00 − 102,824.60.

## Qué propongo construir

### 1. Herramienta "Conciliar estado de cuenta" en el detalle de proveedor
Nueva pestaña/acción que permita subir el EDC del proveedor (XLS/CSV) y obtener el
cruce automático en cuatro grupos: **Coincide**, **Diferencia de importe**,
**Falta en el ERP**, **Sólo en el ERP**. Con KPIs de saldo por cada grupo y exportación
a CSV/PDF para enviar la aclaración al proveedor.

- Mapeo de columnas configurable (folio, importe, moneda, job no., referencia).
- Cruce por folio del proveedor; sugerencia de coincidencia por importe + contenedor
  cuando el folio no exista.
- Desde "Falta en el ERP": botón para abrir la captura de factura de proveedor
  precargada con folio, importe, moneda y el embarque sugerido por contenedor/BL.
- Desde "Sólo en el ERP": abrir la factura para revisar pago o nota de crédito.
- La conciliación es sólo lectura: no crea ni modifica facturas por su cuenta.

### 2. Reporte de las 12 facturas en disputa
Vista/expediente listando esas 12 facturas con su embarque, contenedores y pagos, para
que contabilidad decida en cada caso: registrar pago faltante, aplicar nota de crédito
o cancelar por duplicidad.

### 3. Captura de las 17 facturas faltantes
Se hará con el ERP en la mano (no la automatizo yo): la herramienta del punto 1 deja el
listado exportado y los enlaces de captura precargados, y el usuario confirma el
embarque de cada una.

## Detalles técnicos

- Parseo del archivo en el cliente con la librería de hojas de cálculo ya usada para
  importaciones; el `.xls` binario se convertirá pidiendo al usuario `.xlsx`/CSV o
  agregando soporte de lectura legacy.
- Cruce en dominio puro (`src/features/proveedor/domain/conciliacionEdc.ts`), 100 %
  testeado, sin lógica en componentes.
- Los saldos del ERP se leen con las funciones existentes (`saldo_factura_proveedor`,
  estado de cuenta del proveedor) para no duplicar reglas de multi-moneda ni NC.
- Sin migraciones nuevas en la primera etapa: la conciliación no persiste. Si luego
  quieres guardar el histórico de conciliaciones, se agrega tabla en una segunda etapa.
- Se registra en `CHANGELOG.md` y se sube `APP_VERSION`.
