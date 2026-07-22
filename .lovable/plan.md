
## Bug

En el tab **Cierre** del embarque 235 (`ELIMP00235`), el check "Cuentas por cobrar al día" muestra **saldo MXN $5,220**, cuando la única factura del embarque es **USD 5,220**.

### Causa raíz (verificada)

1. **Base de datos**: la factura `a5fd3b26…` es `USD 5,220`, estado `Pagada`, sin `pagos_factura` ni notas de crédito. `saldo_factura(...)` devuelve `5220` (numérico, sin moneda).
2. **RPC `validar_embarque_para_cierre`** (`supabase/migrations/20260722173633_…sql`, líneas 123-140): suma `total`, `pagado`, `notas_credito`, `saldo` en una sola variable numérica **sin separar por moneda** y arma `detalle` sin campo `moneda`. Lo mismo pasa en el check `cxp_pagada` (L102-112).
3. **Formatter** `fmtCxc` / `fmtCxp` (`src/features/embarques/utils/cierreCheckFormatters.ts`, L12-32) llaman a `formatCurrencySafe(saldo)` sin pasar moneda → cae al default MXN.

Además, el saldo de 5,220 aparece porque la factura está `Pagada` sin `pagos_factura`. No lo tocamos en este cambio (es dato heredado); sólo corregimos que la UI diga la moneda real.

## Alcance del cambio

Corregir la UI para que refleje la moneda real, soportando embarques con facturas mixtas MXN + USD.

### 1. RPC `validar_embarque_para_cierre` (nueva migración)

Reescribir los dos bloques (`cxc_cobrada` y `cxp_pagada`) para agrupar por moneda:

- `cxc_cobrada.detalle` pasa de `{ total, pagado, saldo, notas_credito }` a `{ por_moneda: [{ moneda, total, pagado, notas_credito, saldo, facturas_pendientes }], saldo_total_absoluto }`.
- `cxp_pagada.detalle` análogo: `{ por_moneda: [{ moneda, total, pagado, saldo, facturas_pendientes }] }`.
- La condición `v_ok` sigue basada en que **todos** los saldos (cualquier moneda) estén ≤ 0.01.

Sin cambios de firma del RPC; sólo cambia el shape interno de `detalle` para esas dos reglas.

### 2. Formatters `fmtCxc` y `fmtCxp`

Actualizar `src/features/embarques/utils/cierreCheckFormatters.ts` para leer `por_moneda[]` y emitir texto tipo:

```
2 factura(s) por cobrar · saldo USD $5,220.00
```

o cuando hay mezcla:

```
saldo MXN $1,200.00 + USD $500.00
```

Mantener retro-compatibilidad: si el detalle viejo (sin `por_moneda`) llega (por caché), seguir usando el path actual con default MXN para no romper.

### 3. Tests

- Ajustar tests unitarios de los formatters (si existen bajo `src/features/embarques/utils/__tests__/`) para cubrir: sola MXN, sola USD, mezcla, y shape legacy.
- No se requieren cambios en tests de arquitectura.

### 4. Housekeeping

- `APP_VERSION` → `13.308.5`.
- Entrada en `CHANGELOG.md`: "Fix: checks CxC/CxP del cierre muestran la moneda real (soporta multi-divisa)."

## Fuera de alcance

- Reconciliación de la factura `Pagada` sin `pagos_factura` (dato heredado; puede tratarse aparte si el usuario lo pide).
- Cambios en otros checks del cierre.
