# Auditoría: "Utilidad MXN proyectada" infla la utilidad en Arribos del mes

## Qué encontré (verificado con datos reales)

La tarjeta **no calcula mal**: suma venta menos costo de los embarques con ETA de este mes. El problema está en los **costos**, que llegan con renglones negativos enormes.

Los tres embarques que dominan la cifra tienen un renglón de costo negativo gigantesco:

| Embarque | Costo real (Flete) | Renglón "Ajuste factura" | Utilidad inflada |
|---|---|---|---|
| ELIMP00368 | 34,400 USD | −546,777.68 USD | ~9.4 M MXN |
| ELIMP00379 | 14,811 USD | −235,416.40 USD | ~4.0 M MXN |
| ELIMP00336 | 13,479 USD | −214,244.66 USD | ~3.8 M MXN |
| ELEXP00404 | 332 USD | −5,277.04 USD | ~0.09 M MXN |

Los números no son casuales: 34,400 − (34,400 × 16.8947) = −546,777.68. Es decir, el sistema restó **pesos contra dólares**. Es exactamente el mismo error que corregimos ayer en ELIMP00358 (−953.68 USD), pero a mayor escala: al capturar la factura del proveedor el monto base se congeló convertido a MXN, luego la factura quedó en USD, y el "ajuste" nació de comparar peras con manzanas.

En toda la base hay **34 renglones de costo negativos**, todos en USD, por −1,423,727 USD acumulados; la mayoría son "Ajuste factura …".

Analogía: la balanza está bien; alguien puso pesas en gramos de un lado y en kilos del otro.

## Qué se va a corregir

### 1. Limpiar los ajustes fantasma (datos)
Identificar y anular con soft-delete únicamente los renglones `origen = 'ajuste_factura_proveedor'` que cumplan las dos condiciones a la vez:
- monto negativo, y
- valor absoluto **mayor que el total de la factura de proveedor** que lo originó (un descuento nunca puede superar la factura completa).

Antes de anular nada se lista el detalle de los 34 candidatos con su factura, para separar descuentos legítimos (pequeños) de fantasmas. Los legítimos se dejan intactos. La limpieza se hace por la RPC existente de ajustes / soft-delete con trazabilidad; no se toca el costo original, ni la factura, ni pagos, ni IVA, ni estados.

### 2. Cerrar la causa raíz (código)
El candado que agregamos ayer compara la moneda congelada del vínculo contra la moneda de la factura, pero deja pasar los vínculos viejos sin `monedaBase`. Además nada valida la magnitud. Se añaden dos cierres:

- **Cliente**: descartar el ajuste cuando la base congelada no tiene moneda declarada y el delta resulta desproporcionado (mayor al total de la factura).
- **Servidor (RPC `crear_ajustes_factura_proveedor_rpc`)**: rechazar cualquier ajuste cuyo valor absoluto exceda el total de la factura. Este es el candado real: aunque una versión vieja del front siga desplegada, la base no vuelve a aceptar un ajuste imposible.

### 3. Sin cambios en el dashboard
La tarjeta y su tooltip se quedan igual; el número correcto sale solo cuando los costos están limpios. No se agregan pantallas, tablas ni reportes.

## Detalle técnico

- Consulta de clasificación: `conceptos_costo` con `origen='ajuste_factura_proveedor'`, `deleted_at IS NULL`, unida por `proveedor_facturas_conceptos` a `proveedor_facturas` para comparar `abs(monto)` contra `total` y `moneda`.
- Limpieza vía `crear_ajustes_factura_proveedor_rpc(<factura>, '[]'::jsonb)` por factura afectada (ya hace limpieza idempotente + soft-delete con trazabilidad), igual que en ELIMP00358.
- Migración que reemplaza `crear_ajustes_factura_proveedor_rpc` agregando la validación de magnitud (`abs(delta) > total_factura` → excepción con mensaje claro), conservando `SECURITY DEFINER`, `search_path`, GRANTs y firma. Espejo en `supabase/schema/cxp/` y baseline regenerada.
- `crearAjustesFacturaProveedor.ts`: filtro adicional para vínculos legacy sin `monedaBase`.
- Pruebas focalizadas: delta desproporcionado descartado; delta legítimo conservado; vínculo legacy sin moneda con delta razonable sigue funcionando.
- Cierre: `bun run db:postcheck`, `CHANGELOG.md` y bump de `APP_VERSION`. CI, RLS y E2E completos quedan para GitHub Actions.

## Verificación final
Recalcular la utilidad proyectada de arribos del mes antes/después y confirmar que baja de la cifra actual (dominada por los ~17 M MXN fantasma) a la utilidad real de los embarques.
