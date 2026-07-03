## Bimoneda: Proforma USD+MXN → 2 borradores de factura

**Contexto**: PRO-2026-0951 tiene 5 conceptos (4 USD, 1 MXN). Hoy la RPC:
- Mezcla ambas monedas en una sola factura calculando un tipo de cambio (viola regla SAT).
- Lee conceptos de `proforma_conceptos_consolidados`, que sólo se llena para proformas consolidadas — para proformas normales queda vacío y la factura sale sin conceptos.

**Analogía**: Es como pedir un recibo en la tiendita que mezcla pesos con dólares. Vamos a partir el ticket en dos: uno de pesos y uno de dólares, y a leer los productos directo del carrito (conceptos_venta), no del papelito consolidado.

### Cambios

#### 1. Migración: `convertir_proformas_a_factura` v2

- Cambia el retorno de `RETURNS facturas` a `RETURNS SETOF facturas` (0..2 filas).
- Elimina el cálculo de `tipo_cambio` mixto y el `RAISE` cuando no cuadra una sola moneda.
- Nuevo flujo por cada moneda con total > 0 (USD y/o MXN):
  1. `INSERT INTO facturas (...)` con esa moneda y sus totales/IVA.
  2. Inserta conceptos_factura con la fuente correcta:
     - Si `v_first.es_consolidada` = true → `proforma_conceptos_consolidados WHERE moneda = <curr>`.
     - Si no → `conceptos_venta WHERE proforma_id = ANY(...) AND moneda = <curr> AND deleted_at IS NULL`.
  3. Registra entrada en `bitacora_actividad` por cada borrador.
- Persiste en `proformas`:
  - `factura_id` = MXN (si existe) o USD; `factura_secundaria_id` = la otra si existen ambas.
  - `estado_proforma = 'facturada'`, `fecha_facturacion = CURRENT_DATE`.
- Idempotencia: `idempotency_store` guarda `jsonb_build_object('facturas', jsonb_agg(...))`; al reclamar cache, devuelve las filas de `facturas` correspondientes.
- Todas las validaciones existentes (roles, cliente único, org única, no ya facturada) se conservan.

#### 2. Servicio TS `src/features/proformas/services/convertirAFactura.ts`

- `ConvertirProformaResult` pasa a `Array<{ facturaId: string; facturaNumero: string; moneda: "MXN" | "USD" }>`.
- Ajusta parsing del `data` (ahora array) y valida `length >= 1`.

#### 3. Hook `useConvertirProformaDirecto`

- `onSuccess` recibe array. Cambia el toast:
  - 1 borrador: mensaje actual con moneda.
  - 2 borradores: "Se generaron 2 borradores (MXN y USD). Revísalos en Facturación."
- **Ya no navega a `/facturacion/:id`**. Se queda en la proforma (decisión del usuario). Invalida `["proformas"]`, `["proforma-detalle"]`, `["facturas"]`.

#### 4. Tests

- Actualiza `convertirAFactura.test.ts` para el nuevo shape de retorno (array).
- Agrega test unitario: cuando data devuelve dos filas, retorna array de longitud 2 con las monedas correctas.

#### 5. Version + changelog

- Bump `APP_VERSION` a `13.160.0` (feature).
- Entrada en `CHANGELOG.md` describiendo split bimoneda y fix de fuente de conceptos.

### Verificación

Después de la migración, reintentar conversión de PRO-2026-0951:
- Deben aparecer 2 filas en `facturas` (una MXN 47,560 y una USD 1,603.40) enlazadas por `proforma_id` = 419c… y por `proformas.factura_id` / `factura_secundaria_id`.
- Cada factura con sus conceptos correspondientes (4 USD, 1 MXN).
- Proforma en estado `facturada`.
- Toast en `/proformas/419c…` sin navegación.

### Fuera de alcance

- No se toca el flujo consolidado (`consolidar_proformas`) ni `marcarProformaFacturada` legacy.
- No se cambia el modelo de datos (no migración de estructura).
- Timbrado FacturAPI queda pendiente por factura (flujo actual, cada borrador se timbra por separado).
