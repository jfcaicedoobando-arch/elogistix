## Diagnóstico

En la bandeja **Por cobrar** (`/facturacion?bandeja=por-cobrar`) hay dos problemas:

### 1. Bug real: todas las filas dicen "Vence hoy"

En `src/features/facturacion/services/cobranza.ts:127` se guarda:

```ts
dias_vencido: Math.max(0, diasVencido),
```

Es decir, para facturas que **aún no vencen** se pierde el signo negativo y `dias_vencido` queda en `0`. Luego `agingPorCobrarBucket(0)` (aging.ts:53) calcula `faltan = -0 = 0`, cae en la rama `faltan <= 0` y devuelve **"Vence hoy"** para toda factura no vencida.

El mismo `Math.max(0, ...)` rompe `cobranzaAggregates.ts:83` (`f.dias_vencido <= 0 && >= -7`), que nunca detecta las "próximas a vencer". Los tests (`cobranza.test.ts`, `cobranzaAggregates.test.ts`) ya asumen valores negativos (`-2`, `-3`, `-8`), así que el clamp es lo que está mal.

`BandejaVencidas` solo lee valores positivos, así que no se ve afectada.

### 2. Redundancia UX: "Vence" y "Vence en" juntas

`BandejaPorCobrar.tsx` muestra:
- **Vence** → fecha de vencimiento (dd/mm/aaaa)
- **Vence en** → badge con días restantes

Ambas columnas expresan lo mismo. La fecha es referencia dura; el badge aporta color/urgencia. Se conservan las dos pero el badge se vuelve informativo (no otro dato redundante) mostrando también el signo cuando ya venció (defensa por si llega una fila con `dias_vencido > 0`).

## Cambios

### A. Corregir sign de `dias_vencido` en el servicio
`src/features/facturacion/services/cobranza.ts`
- Línea 127: cambiar `dias_vencido: Math.max(0, diasVencido)` por `dias_vencido: diasVencido` (valor con signo: negativo = faltan días, positivo = días vencidos, 0 = vence hoy).
- Con esto `agingPorCobrarBucket` y `cobranzaAggregates` recuperan su lógica original ya probada.

### B. Endurecer `agingPorCobrarBucket`
`src/features/facturacion/utils/aging.ts`
- Manejar explícitamente los 3 casos: `faltan > 7` (holgado, gris), `1 ≤ faltan ≤ 7` (warning suave), `faltan === 0` (vence hoy, warning fuerte), y **fallback `faltan < 0`** por seguridad (mostrar "Venció hace N d" en destructivo) para que jamás vuelvan a mostrarse todas como "Vence hoy" si algún día vuelve a llegar un positivo.

### C. Reforzar tests
`src/features/facturacion/utils/__tests__/aging.test.ts`
- Añadir casos: `agingPorCobrarBucket(-10) → "10 d"`, `agingPorCobrarBucket(-3)` warning suave, `agingPorCobrarBucket(0) → "Vence hoy"`, `agingPorCobrarBucket(2)` fallback destructivo.

`src/features/facturacion/services/__tests__/cobranza.test.ts`
- Añadir test que verifique que una factura con `fecha_vencimiento` futura devuelve `dias_vencido` **negativo** (no `0`).

### D. Changelog + versión
- `APP_VERSION` → `13.300.18`.
- Entrada en `CHANGELOG.md` describiendo el fix.

## Detalle técnico

El bug fue introducido al agregar el clamp defensivo en el servicio; el resto del sistema (buckets, aggregates, tests) ya asumía la convención con signo. Es un cambio de una sola línea + endurecimiento del bucket y pruebas para blindarlo.

No se toca la UI de columnas: el usuario ya tiene fecha (`Vence`) + badge (`Vence en`); tras el fix el badge mostrará valores correctos ("12 d", "5 d", "Vence hoy") en vez de "Vence hoy" para todo.
