# Auditoría embarque ELIMP00300: el margen negativo es un bug (IVA en el costo)

## Qué encontré en los datos reales

Expediente **ELIMP00300** (contenedor TGBU4635520):

| Concepto | Monto |
|---|---|
| Venta (facturas al cliente, **sin IVA**) | 76,125.00 MXN |
| Costo que reporta el sistema | 76,371.50 MXN |
| Utilidad que reporta el sistema | **−246.50 MXN (−0.32 %)** |

Las dos facturas de proveedor son:

| Folio | Moneda | Subtotal | IVA | Total |
|---|---|---|---|---|
| L-796 (Heregar) | MXN | 60,500.00 | 9,680.00 | 70,180.00 |
| A-9560 (Sercoguamex) | USD | 305.00 | 48.80 | 353.80 |

76,371.50 = 70,180 + (353.80 × 17.50). Es decir, **el costo se está sumando con IVA incluido**, mientras la venta se compara sin IVA. Comparación asimétrica.

Costo correcto sin IVA: 60,500 + (305 × 17.50) = **65,837.50 MXN**
Utilidad real: 76,125.00 − 65,837.50 = **+10,287.50 MXN (13.5 % de margen)**

Analogía: es como comparar el precio de venta de un producto contra lo que pagaste *incluyendo* el impuesto que Hacienda te va a devolver. El IVA acreditable no es costo del embarque.

Efecto colateral: la regla `margen_minimo` del checklist de cierre bloquea hoy el cierre de este embarque por un margen negativo que no existe.

## Causa raíz (una sola)

La función de base de datos `public.pnl_financiero_embarque` calcula el costo real a partir de `proveedor_facturas.total` (con IVA) y la venta real a partir de `facturas.subtotal` (sin IVA). `public.validar_cierre_embarque` consume ese mismo resultado, así que hereda el error. Ninguna otra función de la base usa ese patrón.

## Qué haría para corregirlo

1. **Migración** que recrea `public.pnl_financiero_embarque` usando la base gravable del proveedor en lugar del total:
   - costo por factura = `subtotal` (con respaldo a `total − iva − retenciones` si `subtotal` viniera nulo en registros legacy),
   - se conservan las notas de crédito de proveedor aplicadas restándose sobre esa base,
   - se conserva la lógica de saldos pendientes (`pdte_pago_mxn`) tal como está, porque el flujo de caja **sí** se paga con IVA.
2. **Segundo hallazgo menor (sólo desglose)**: la factura L-796 tiene dos renglones de 60,500 en `proveedor_facturas_conceptos` ("Servicios Profesionales de Logistica" y "Servicio logistico / TGBU4635520"), lo que duplica el renglón en el desglose "por concepto de costo" del P&L. No afecta el total (el total viene del encabezado de la factura), pero se ve confuso. Lo dejaría marcado como limpieza de datos aparte y lo confirmaría contigo antes de tocar renglones ya conciliados.
3. **Verificación** posterior al cambio: volver a ejecutar el P&L y el checklist de cierre de ELIMP00300 y confirmar utilidad ≈ +10,287.50 MXN y la regla `margen_minimo` en verde.
4. Registrar el cambio en `CHANGELOG.md` y subir `APP_VERSION`.

No hay cambios de UI: la pantalla ya muestra correctamente lo que la función le devuelve.

## Alcance del impacto

Al ser un cálculo en vivo (no un valor guardado), la corrección arregla de inmediato **todos** los embarques del ERP: cualquier expediente con facturas de proveedor gravadas está hoy sobrevaluado en costo por el 16 % de IVA, y varios pueden estar bloqueados de cierre por márgenes falsos negativos.
