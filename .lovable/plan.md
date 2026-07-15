## Diagnóstico

El error viene del **SAT**, no de nosotros ni de FacturApi. FacturApi es sólo el intermediario; cuando el SAT devuelve "CancelacionSAT no está disponible", significa que el web service oficial del SAT está caído o saturado (pasa varias veces al mes, típicamente unos minutos).

**Analogía:** Es como cuando la terminal bancaria dice "banco no disponible". Ni la tienda ni la terminal fallaron — el banco allá lejos no contesta. Toca reintentar en un rato.

Tu versión reportada es `13.300.57`, pero ya estamos en `13.300.59`. Aun así, ese cambio no habría evitado este error porque es un problema externo. Lo que sí podemos hacer es que la app lo maneje mejor.

## Plan (2 mejoras chicas y focalizadas)

### 1. Detectar el error específico y mostrar mensaje humano

En `supabase/functions/facturapi-cancelar/index.ts` (donde ya enriquecemos el error "no cancelable"), agregar otro patrón para `CancelacionSAT no está disponible`. En vez del texto crudo del SAT, devolver:

> "El SAT no está respondiendo en este momento (servicio de cancelación caído). No es un problema de tu factura ni de tus datos. Espera unos minutos e intenta de nuevo."

Y marcar el error con un flag `transient: true` en el payload para que la UI lo pinte distinto (ícono de reloj en lugar de ícono de error rojo).

### 2. Botón "Reintentar" en el toast de error

En `DialogCancelarFactura.tsx` (o el hook `useTimbrarFactura` que dispara la cancelación), cuando el error tenga `transient: true`:
- Mostrar toast ámbar (no rojo).
- Añadir acción "Reintentar" que vuelve a llamar la mutación sin cerrar el modal.
- El modal queda abierto con los datos ya llenados para no perder el trabajo.

## Detalles técnicos

**Archivos a tocar:**
- `supabase/functions/facturapi-cancelar/index.ts` — añadir regex `/CancelacionSAT no est/i` en el bloque que hoy detecta "no cancelable"; devolver `{ error, transient: true, retryAfterSec: 120 }`.
- `src/features/facturacion/hooks/useCancelarFactura.ts` (o donde viva la mutación) — leer `transient` del error y propagarlo.
- `src/features/facturacion/components/DialogCancelarFactura.tsx` — al recibir error transient, mostrar toast con acción "Reintentar" y no cerrar el diálogo.
- `CHANGELOG.md` + `src/constants/appVersion.ts` → `13.300.60`.

**Lo que NO vamos a hacer:**
- Reintento automático silencioso: peligroso con timbrado fiscal (podría duplicar operaciones si el SAT sí procesó pero cortó la respuesta). Mejor manual y consciente.
- Cambios en la lógica de sustitución: el flujo ya funciona, sólo falló el paso final por caída externa.

## Qué pasa mientras tanto con la F971

Puedes intentar cancelarla de nuevo ahora mismo (probablemente el SAT ya volvió). Si sigue igual, espera 10–30 minutos. La factura sustituta F981 ya quedó timbrada y válida; sólo falta cerrar el ciclo cancelando la vieja.

¿Procedo con el plan?
