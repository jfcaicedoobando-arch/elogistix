## Problema

Al intentar eliminar un pago, el usuario recibe **"Error al eliminar pago"** con `errorDetails: {}` — no sabemos qué falló porque el `catch` en `FacturaPagosSection.tsx` está vacío (`catch { ... }` sin capturar el error) y descarta el mensaje real del backend.

Además, hay un **doble toast**: el hook `useEliminarPagoFactura` ya muestra `notifyError` con `error.message` en su `onError`, y el componente muestra otro toast genérico encima, pisando el diagnóstico útil.

### Hipótesis del origen real
La factura del caso (`5945e7ca…`) está en estado **`Pagada`** y no tiene REP timbrado, por lo que ni RLS, ni constraints, ni triggers deberían bloquear el soft delete. La causa raíz no es visible hasta que dejemos de perder el mensaje del backend. Este cambio nos deja ver el error real la próxima vez que el usuario reproduzca el flujo.

## Cambios (analogía: hoy la app "traga" el papelito con el error; vamos a leerlo antes de tirarlo)

1. **`src/features/facturacion/components/detalle/FacturaPagosSection.tsx`**
   - Reemplazar el `catch { ... }` vacío por `catch (error) { ... }`.
   - Pasar `error` a `notifyError({ error, ... })` para que el toast incluya el mensaje real de Supabase.
   - Quitar el toast duplicado: dejar que el hook `useEliminarPagoFactura` (que ya tiene `onError` con `notifyError`) sea la única fuente del toast de error. El componente sólo maneja el éxito (bitácora + notifySuccess + cerrar diálogo).

2. **`src/features/facturacion/hooks/usePagosFactura.ts`**
   - Confirmar que el `onError` existente ya adjunta `error` — sí lo hace (línea 44). Sin cambios.

3. **Versionado**
   - Bump `APP_VERSION` a `13.299.7`.
   - Entrada en `CHANGELOG.md`: "Fix: propagar detalle real del error al eliminar pago (antes se mostraba mensaje genérico)".

## Fuera de alcance
- No tocar RLS ni triggers de `pagos_factura`: con los datos actuales del caso no hay evidencia de bloqueo por policy/constraint. Si tras el fix diagnóstico el mensaje real apunta a RLS o a un trigger, abrimos un segundo plan con esa evidencia.
