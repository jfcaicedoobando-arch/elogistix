# Auditoría del backlog v5 (45 bugs): qué sigue realmente abierto

Verifiqué los 45 hallazgos uno por uno contra la base de datos viva (definiciones de funciones, triggers, policies, constraints, índices) y contra el código actual. **36 ya están corregidos** por las olas anteriores. Quedan **9** con trabajo real.

## Resultado por nivel de esfuerzo

| Nivel | Corregidos | Abiertos / parciales |
|---|---|---|
| E1 (13) | 12 | M3-res |
| E2 (12) | 9 | L3, C3-res, C9 |
| E3 (11) | 9 | N18, N19 |
| E4 (8) | 7 | M6 |
| E5 (1) | 0 | N13 |

## Lo que sí está abierto

**1. M3-res · Email de cliente duplicado (E1, Medium) — ABIERTO**
No existe el índice único por organización sobre el email del cliente; la unicidad depende sólo de un trigger, así que dos altas simultáneas crean duplicados. Ya hay un caso real: en la organización `…0001` el correo `betoazaver@hotmail.com` está en dos clientes activos. Hay que resolver ese duplicado antes de poder crear el índice.

**2. N18 · Falta idempotencia en refacturación y cancelaciones CxP (E3, Medium) — ABIERTO**
`duplicar_factura_para_refacturacion`, `cancelar_factura_proveedor`, `cancelar_anticipo_proveedor` y `aprobar_nota_credito_proveedor` no usan el patrón `idempotency_claim/store` que ya existe en el proyecto. Sólo se protegen con guardas de estado: la doble cancelación queda cubierta, pero un doble clic en refacturación sí puede crear dos borradores del mismo CFDI.

**3. N19 · Bitácora sin cambios financieros (E3, Medium) — ABIERTO**
Sólo existe bitácora para el cambio de estado de facturas. No se registran: montos y tipo de cambio en embarques; cliente, subtotal y T/C en facturas borrador; ninguna edición de movimientos bancarios ni de comisiones.

**4. M6 · Dos copias vivas de la conversión de notas de crédito (E4, Medium) — PARCIAL**
El helper canónico ya lo usan saldo de factura, recálculo de estado, cartera del cliente y profit por cliente. Pero `cartera_pendiente()` reimplementa la misma cascada de monedas en línea: es la fuente del próximo desajuste.

**5. C3-res · Guard cross-tenant asimétrico (E2, High) — PARCIAL**
Anticipos y conceptos de factura de proveedor tienen dos candados de tenant cada uno; las notas de crédito de proveedor sólo uno. Hay que confirmar si le falta alguna relación padre por validar.

**6. C9 · Costos de cotización (E2, High) — PARCIAL, sólo confirmar**
La policy de base y la matriz de permisos del front ya están alineadas (vendedor ve costos sólo de sus cotizaciones). Falta comparar el criterio exacto de "cotización propia" en ambas capas para cerrarlo.

**7. L3 · Importación masiva sin detalle de fallo (E2, Low) — PARCIAL**
Hoy muestra "se guardaron N de M". Falta el desglose por fila (qué filas fallaron y por qué).

**8. N14 · Anticipos en EUR (E3, Medium) — limitación conocida**
El cruce de monedas soporta MXN↔USD; EUR se rechaza con un error claro. No es un cálculo equivocado, es una función faltante. Decidir si entra al alcance.

**9. N13 · Devolución de anticipos y saldo a favor (E5) — ABIERTO**
No existe función de devolución de anticipo a proveedor ni modelo de saldo a favor de cliente. Requiere decisión de producto antes de diseñarlo.

## Hallazgos que el backlog reportaba mal

Vale la pena corregir el documento fuente, porque tres puntos afirman cosas que hoy no son ciertas:

- **C4 y C5** (marcados "Critical, NO CORREGIDO") están cerrados: hay un trigger que valida el cliente contra la organización en embarques, y la creación de proforma rechaza conceptos de otro embarque con `LC_CONCEPTOS_AJENOS`.
- **N1** (REP sin notas de crédito, "Critical") está corregido: el complemento de pago ya descuenta notas de crédito además de pagos previos.
- **N15** menciona una cascada de borrado en proformas que hoy es RESTRICT.

## Orden propuesto para la siguiente ola

1. M3-res (limpiar el duplicado + índice único) — riesgo de datos vivo.
2. C3-res y C9 — cierre de aislamiento entre organizaciones.
3. N18 (idempotencia) y M6 (una sola fuente de conversión de NC).
4. N19 (bitácora financiera).
5. L3 (detalle de importación).
6. N14 y N13 — requieren decisión tuya antes de diseñar.

## Detalles técnicos de la verificación

- Estado leído de `pg_proc`, `pg_trigger` (incluida la lista de columnas de `UPDATE OF`), `pg_policy` (`polwithcheck`), `pg_constraint` (`convalidated`, `confdeltype`), `pg_indexes` y `pg_get_viewdef`, no de las migraciones históricas.
- La comparación baseline vs. cadena de migraciones (#37) ya la cubre el job `schema-baseline` del CI; `dashboard_details_datos` coincide byte a byte con el baseline.
- No quedan claves foráneas compuestas en el esquema vivo (#44).
- Esta auditoría no modificó nada.
