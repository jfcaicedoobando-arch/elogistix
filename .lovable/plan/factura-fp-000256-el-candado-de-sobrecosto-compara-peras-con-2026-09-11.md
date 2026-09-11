# Factura FP-000256: el candado de sobrecosto compara peras con peras usando dos tipos de cambio

## Qué está pasando (confirmado en la base)

La factura `034G545923` (FP-000256, interna) está por **60 USD** y quedó vinculada al concepto de costo **"Cargos Destino"** del expediente **ELIMP00358**, que está comprometido por **60 USD**. Es el mismo importe y la misma moneda: no hay sobrecosto real.

El bloqueo aparece porque, antes de comparar, el sistema traduce los dos lados a pesos usando **dos tipos de cambio distintos**:

```text
Costo comprometido:  60 USD x 17.3317 (T/C del expediente) = 1,039.90 MXN
Factura del proveedor: 60 USD x 19.4715 (T/C de la factura) = 1,168.29 MXN
Diferencia "sobrecosto": 128.39 MXN  =  12.3%  >  5% permitido  -> bloquea
```

Los 128.39 pesos no son un cobro extra del proveedor: son puro efecto del tipo de cambio. El candado está diseñado para atrapar sobreprecios, no diferencias cambiarias.

Como dato adicional: la fecha de emisión guardada en esa factura es **01/01/2023**, valor claramente heredado de la lectura automática del PDF, y su tipo de cambio quedó en 19.4715. Eso amplifica la diferencia, pero no es la causa raíz.

## Solución propuesta (mínima)

1. **Comparar en la moneda original cuando ambos lados coinciden.** Si el costo comprometido y lo facturado están en la misma moneda (USD contra USD, MXN contra MXN), comparar directamente esos importes, sin convertir a pesos. Sólo cuando las monedas difieren se sigue usando la conversión actual.
2. **Mensaje en la moneda comparada**, para que el usuario lea "60 USD contra 60 USD" y no cifras en pesos que no reconoce.
3. **No se toca nada más**: sigue vigente el margen de 5%, la advertencia por excesos menores, el requisito de tipo de cambio para cruces de moneda, los importes, el IVA, los pagos, los permisos y las políticas de acceso.

Con esto, FP-000256 podrá aprobarse sin intervención manual, y cualquier factura en la misma moneda que su costo dejará de bloquearse por movimientos del dólar.

## Aparte (a decidir contigo, no incluido arriba)

La fecha de emisión 01/01/2023 de esta factura parece incorrecta. Si me confirmas la fecha real del CFDI, la corrijo en un paso separado; también puedo revisar por qué la lectura automática la dejó así.

## Detalles técnicos

- Función afectada: `public._cxp_validar_aprobacion` (espejo `supabase/schema/cxp/_cxp_validar_aprobacion.sql`).
- Cambio en el bucle de tope por concepto: añadir la moneda del concepto y de cada factura ligada; cuando todas coinciden, acumular `monto * cantidad` en esa moneda y comparar contra `conceptos_costo.monto` sin pasar por `a_mxn_doc`. Si hay mezcla de monedas, se mantiene la ruta MXN actual (incluido el `LC_CXP_SIN_TC` cuando falta T/C).
- Nueva migración en `supabase/migrations/` + espejo canónico actualizado en el mismo cambio (requisito de `audit:schema-functions` / `audit:replay-mirror`). No se editan migraciones ya aplicadas.
- Pruebas SQL en `supabase/tests/` para: misma moneda igual importe (aprueba), misma moneda con exceso >5% (bloquea), monedas distintas (comportamiento actual intacto).
- Validación local: pruebas focalizadas de CxP, typecheck, ESLint focalizado, `audit:schema-functions`, `audit:manifest`, `db:postcheck`. CI, RLS globales y E2E quedan para GitHub Actions.
- `APP_VERSION` + entrada en `CHANGELOG.md`.
