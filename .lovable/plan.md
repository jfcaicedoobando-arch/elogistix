## Problema

Al convertir COT-2026-0138 en embarque (E-ELIMP00333), el borrador se creó pero **muchos campos que la cotización sí tenía quedaron vacíos**:

Verificado contra la BD:

| Campo | Cotización 0138 | Embarque generado |
|---|---|---|
| Origen | `Ningbo, China (CNNGB)` | `puerto_origen = NULL` |
| Destino | `Ensenada, México (MXESE)` | `puerto_destino = NULL` |
| Tarifa aplicada | `tarifa_id` presente | `tarifa_id = NULL` |
| Peso | (0 en esta cot) | 0 ✓ |
| Cliente / Incoterm / Modo / Tipo / Tipo contenedor | ✓ | ✓ (sí copiados) |

Causa raíz: `public.crear_embarque_borrador_core` (RPC transaccional) sólo mapea un subconjunto de columnas en el `INSERT INTO embarques (...)`. **No mapea puertos/aeropuertos/ciudades, tarifa, ni datos logísticos** (carta garantía, días libres, seguro, valor seguro), aunque todos existen en ambas tablas.

Además, `cotizaciones.origen`/`destino` son texto libre tipo `"Ningbo, China (CNNGB)"`, y `embarques` los guarda separados según `modo` (`puerto_*` para Marítimo, `aeropuerto_*` para Aéreo, `ciudad_*` para Terrestre). Hay que parsear el código UN/LOCODE (los 5 chars dentro del paréntesis) y volcarlo al campo correcto según `modo`.

## Alcance

Ampliar el mapeo de la RPC para que el borrador arranque con todo lo que ya se conocía en la cotización. Sin cambios de UI.

## Cambios

### 1. Migración: `crear_embarque_borrador_core` extendida

Dentro del `INSERT INTO public.embarques (...)`, añadir:

- **Ruta** — parsear `v_cot.origen` / `v_cot.destino` extrayendo el código entre paréntesis (fallback: guardar el texto completo si no hay paréntesis):
  - `modo = 'Marítimo'` → `puerto_origen`, `puerto_destino`
  - `modo = 'Aéreo'` → `aeropuerto_origen`, `aeropuerto_destino`
  - `modo = 'Terrestre'` → `ciudad_origen`, `ciudad_destino`
- **Tarifa**: `tarifa_id`, `tarifa_id_original`, `tarifa_id_aplicada` ← `v_cot.tarifa_id`
- **Logística**: `carta_garantia`, `dias_libres_destino`, `dias_almacenaje`, `seguro`, `valor_seguro_usd`
- **Vendedora** (si existe en la oportunidad vinculada): dejar en fase posterior; no en este alcance.

### 2. Backfill para el embarque existente (E-ELIMP00333)

Un `UPDATE` en la misma migración que rellene `puerto_origen`, `puerto_destino` y `tarifa_id` para el embarque 375ec92f… con los datos de COT-2026-0138, de modo que el usuario ya vea el borrador correcto sin recrearlo.

### 3. Tests

- `src/lib/__tests__/crear-embarque-borrador-precarga.test.ts`: dado un mock/fixture con cot Marítimo con `origen="X (ABCDE)"` y `tarifa_id`, verificar que el embarque insertado tenga `puerto_origen='ABCDE'` y `tarifa_id` copiada.
- Caso Aéreo → `aeropuerto_*`. Caso Terrestre → `ciudad_*`.
- Caso `origen` sin paréntesis → se guarda el texto completo.

### 4. Changelog y APP_VERSION

- `CHANGELOG.md`: nueva entrada `## [13.303.15] - 2026-07-20` describiendo el fix y el backfill de E-ELIMP00333.
- Bump de `APP_VERSION` a `13.303.15`.

## Fuera de alcance

- Rediseño de `cotizaciones.origen/destino` a columnas estructuradas (proyecto mayor).
- Copiar conceptos de venta al embarque (ya se copian los costos; venta se maneja en proforma).
