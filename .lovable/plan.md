# FE-15 / BUG-15 — Tolerancia de sobrepago unificada

## Estado verificado hoy

| Archivo | Valor actual | Comentario |
|---|---|---|
| `src/features/facturacion/components/CobroLoteRenglon.tsx:46` | `queda <= 0.005` | Ya usa medio centavo, pero como literal suelto |
| `src/features/facturacion/components/DialogRegistrarPago.tsx:111` | `saldo + 0.01` | Sigue con un centavo: inconsistente |
| `src/lib/financial/toleranciaPago.ts` | No existe | Falta la constante compartida |

Es decir: el parche está aplicado a medias. El cobro en lote ya es estricto, el cobro individual todavía tolera un centavo completo.

## Qué se va a hacer

1. Crear `src/lib/financial/toleranciaPago.ts` con `TOLERANCIA_SOBREPAGO = 0.005` (medio centavo) y su explicación.
2. Usar esa constante en `DialogRegistrarPago.tsx` (reemplaza `0.01`) y en `CobroLoteRenglon.tsx` (reemplaza el literal `0.005`).
3. Añadir una prueba unitaria corta que fije el valor y cubra los casos frontera (sobrepago de 1 centavo bloqueado, redondeo de medio centavo tolerado).
4. Bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Efecto para el usuario

El cobro individual y el cobro en lote decidirán "excede el saldo" y "factura liquidada" con exactamente el mismo criterio. Un sobrepago real de un centavo o más se sigue bloqueando en los dos flujos; sólo se absorbe el error de redondeo al convertir monedas.

## Fuera de alcance

- No se toca la RPC ni la tolerancia del lado servidor (`cobroLoteValidaciones.ts` ya está alineado).
- No se cambia ninguna otra regla de saldos ni de moneda.
