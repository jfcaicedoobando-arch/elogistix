# Ola 16 · Desacoplar la vista previa del wizard de las cancelaciones pendientes del SAT

## Respuesta corta

Sí, vale la pena. Hay una divergencia real y verificada entre las reglas de avance del wizard y la vista previa: cuando la cancelación de un REP (o del CFDI original) ya se solicitó y está **en verificación** con el SAT, la UI permite avanzar con un aviso ámbar, pero la vista previa sigue pintando un bloqueo rojo. El usuario ve "no puedes continuar" y a la vez un botón que sí lo deja continuar.

## Qué está pasando hoy (verificado)

- `refacturacion_simular_paso` (RPC de sólo lectura) cuenta como "REP vivo" cualquier pago con `uuid_rep IS NOT NULL AND rep_cancelado_en IS NULL`, sin mirar `rep_cancellation_status`. Emite `LC_REFACT_REP_VIVO` en pasos 2 y 4.
- Las reglas del frontend (`refacturacionPasos.ts`) sí distinguen: `repsEnVerificacion()` y `cancelacionOriginalEnTramite()` convierten ese caso en **aviso**, no en bloqueo.
- La vista previa (`RefacturacionPreviewPaso.tsx`) renderiza todo `bloqueos[]` con estilo destructivo, sin categoría intermedia.
- En el paso 4 la simulación tampoco considera `facturas.cancellation_status` (`pending`/`verifying`) del CFDI original.
- La invalidación de la vista previa cuando llega el webhook / la sincronización manual ya existe y funciona (`refacturacionSimulacionPrefix`); ahí no hay que tocar nada.

Analogía: el semáforo del cruce (wizard) ya está en verde porque el trámite salió, pero el letrero de la esquina (vista previa) sigue diciendo "camino cerrado" con la información de ayer.

## Qué haremos

1. **Semántica de tres niveles en la simulación.** La RPC devolverá, además de `bloqueos`, un arreglo `pendientes` para lo que está en manos del SAT (`LC_REFACT_REP_EN_VERIFICACION`, `LC_REFACT_ORIGINAL_EN_VERIFICACION`). Un REP con cancelación en verificación pasa de `bloqueos` a `pendientes`; sólo el REP sin solicitud sigue bloqueando.
2. **Paso 4 mira el trámite del original.** Si `cancellation_status` está en `pending`/`verifying`, se reporta como pendiente; si está en `rejected`/`expired`, como bloqueo explícito (`LC_REFACT_ORIGINAL_CANCELACION_RECHAZADA`).
3. **Fuente única de verdad.** Los predicados fiscales quedan en un helper SQL (`public._refact_reps_bloqueantes`) para que la RPC y los candados de escritura usen exactamente el mismo criterio que la UI.
4. **UI diferenciada.** La vista previa muestra los pendientes en tono ámbar con copy claro ("en verificación con el SAT; puedes continuar") y los bloqueos reales en rojo. El bloque destructivo desaparece cuando sólo hay pendientes.
5. **Compatibilidad.** El cliente tolera respuestas sin `pendientes` (arreglo vacío) para no romper cachés en vuelo.

## Detalles técnicos

- Migración: `CREATE OR REPLACE FUNCTION public.refacturacion_simular_paso(uuid, int)` + helper `_refact_reps_bloqueantes(uuid)`, ambos `STABLE SECURITY DEFINER`, `SET search_path = public`, con `REVOKE` a `anon`/`PUBLIC` y `GRANT EXECUTE` a `authenticated`/`service_role` (H6). Espejo en `supabase/schema/facturacion/` para las dos funciones y sync del release manifest.
- Tipos: `SimulacionPaso.pendientes: string[]` en `refacturacionSimulacion.ts`; nuevos códigos en `lcCodeMessages.refacturacion.ts`.
- UI: se extrae `BloqueCodigos` (bloqueos/pendientes con tono parametrizado) para mantener `RefacturacionPreviewPaso.tsx` bajo 200 líneas.
- Tests: casos nuevos en `refacturacionSimulacion.test.ts` (pendiente ≠ bloqueo) y una prueba SQL en la suite RLS de refacturación que valida que un REP en verificación no aparece en `bloqueos` del paso 2 ni del paso 4.
- Cierre: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
