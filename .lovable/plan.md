## Lo que encontré al validar los datos

Las 12 facturas USD de junio **no tienen `tipo_cambio` NULL** como pensé — tienen `tipo_cambio = 1` literalmente guardado en la base:

```
moneda=USD  total=1212.20  tipo_cambio=1
moneda=USD  total=4490.00  tipo_cambio=1
moneda=USD  total=21600.00 tipo_cambio=1
... (12 filas, todas con tc=1)
```

Por eso mi fix anterior no aplicó: mi código sólo usa el fallback cuando `tipo_cambio` es NULL o 0. Como en la base dice "1" explícitamente, lo respeta y multiplica `102,193.20 × 1 = $102.2K MXN`.

## Analogía

Es como si alguien hubiera escrito a mano en cada factura USD "tipo de cambio: 1" en lugar de "tipo de cambio: 17.25". La calculadora hace bien su trabajo, pero el dato de entrada está mal.

## Causa raíz

Hay dos problemas que se combinan:

1. **El código es demasiado confiado**: acepta `tc = 1` para facturas USD como si fuera válido, cuando financieramente nunca lo es (1 USD ≠ 1 MXN).
2. **Los datos están mal**: alguien (o algún flujo de captura previo) guardó las 12 facturas USD con TC=1, probablemente porque el formulario tenía ese default.

## Plan de fix (sólo presentación; los datos los decide el usuario)

### 1. `src/features/facturacion/services/dashboardEjecutivo.ts`

- Cambiar la heurística: para monedas distintas de MXN, considerar `tc <= 1` como **inválido** (no tiene sentido financiero), y aplicar el fallback de tipo de cambio del día.
- Si tampoco hay fallback, excluir la factura y contarla en `facturas_sin_tc`.

### 2. `src/features/facturacion/utils/sumarFacturas.ts`

- Misma heurística (`tc <= 1` → fallback) para que el footer "MXN equivalente" cuadre con el header.

### 3. `src/features/facturacion/components/DashboardEjecutivoFacturacion.tsx`

- Actualizar el copy del tooltip del ⚠️ para mencionar también el caso "TC capturado inválido (≤1) en factura USD/EUR".

### 4. Tests

- Agregar caso `tc=1` para USD → debe usar fallback (no multiplicar por 1).
- Mantener cobertura ≥38%.

## Lo que NO voy a tocar

- **No modificaré las 12 facturas existentes en la base**. Eso es un cambio de datos productivos que requiere tu autorización explícita y debería hacerse vía un formulario de corrección (que ya debe existir) o una migración puntual aparte.
- No tocaré RLS ni el flujo de captura/timbrado de facturas.

## Pregunta para ti (opcional, segundo paso)

¿Quieres que después también te arme una **migración correctiva** para actualizar el `tipo_cambio` de esas 12 facturas USD a un TC realista (p.ej. el TC del día que se emitieron, vía Banxico/Frankfurter)? Sería un cambio aparte (versión `13.135.73`) y requeriría tu OK explícito porque modifica datos contables. SI, OK.

## Versionado

Bump a `13.135.72` ya existe → este fix sube a `**13.135.73**` + entrada en `CHANGELOG.md`.

¿Procedo con el fix defensivo (`tc ≤ 1 → fallback`)? Si