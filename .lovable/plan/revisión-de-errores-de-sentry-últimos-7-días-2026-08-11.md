# Revisión de errores de Sentry (últimos 7 días)

Hay 6 issues sin resolver. Tres son bugs reales, uno ya está corregido pero sin publicar, y dos son "ruido" (validaciones esperadas que no deberían llegar a Sentry).

## 1. Correo transaccional se rompe (bug real, prioridad alta)

`TypeError: Cannot read properties of undefined (reading 'bg')` en `EmailChip`.

Causa confirmada: el catálogo de colores `CHIP_TONES` sólo define `cotizacion`, `proforma`, `factura`, `nota-credito` y `rep`, pero dos plantillas piden tonos que no existen:
- `estado-cuenta-cliente.tsx` usa `tone: 'info'`
- `recordatorio-cobranza.tsx` usa `tone: 'warning'` cuando la factura está vencida

Al no encontrar el tono, `colors` queda `undefined` y el correo falla al renderizarse (el cliente no recibe el estado de cuenta ni el recordatorio de cobranza vencida).

Corrección:
- Agregar los tonos `info` (azul neutro) y `warning` (ámbar) a `CHIP_TONES`.
- Blindar `EmailChip` con un tono por omisión, para que un tono nuevo nunca vuelva a tumbar el envío.
- Prueba unitaria que recorre todas las plantillas y valida que su tono exista en el catálogo.
- Redeploy de las funciones de correo afectadas.

## 2. "function idempotency_store(uuid, unknown, jsonb) does not exist" (ya corregido, falta publicar)

Ocurrió al guardar el embarque en `/embarques/:id/editar`. La firma real en base de datos es de 2 argumentos y alguien la llamaba con 3. Ya está corregido en la base de datos y en el código (v13.509.5); los eventos reportados vienen de la versión publicada `13.509.1`, anterior al fix.

Acción: verificar que ninguna función de base de datos llame con 3 argumentos (ya validado), marcar los dos issues como resueltos en Sentry y publicar para que producción quede en la versión con el fix.

## 3. Validaciones esperadas ensuciando Sentry (ruido)

Dos issues son mensajes de negocio, no fallas: "Este archivo ya está en el buzón esperando captura" y "Este archivo ya fue capturado como factura de proveedor". Son avisos correctos al operador que suben a Sentry como error y esconden los bugs reales.

Corrección: marcar estas validaciones de duplicado como "esperadas" y excluirlas del envío a Sentry con el mismo mecanismo que ya se usa para validaciones de facturación, manteniendo el aviso visible al usuario.

## 4. `HTTP Client Error 500` en `/cotizaciones/nueva` (1 evento, 4 días)

Un solo evento, sin reproducción. Se revisarán los logs de la función involucrada; si no hay señal, se deja monitoreado y se documenta en lugar de "arreglar a ciegas".

## Detalles técnicos

- `supabase/functions/_shared/transactional-email-templates/_layout/tokens.ts`: ampliar `CHIP_TONES` y `ChipTone`.
- `.../_layout/EmailLayout.tsx`: `const colors = CHIP_TONES[tone] ?? CHIP_TONES.info`.
- Redeploy de las edge functions que renderizan `estado-cuenta-cliente` y `recordatorio-cobranza`.
- `src/features/cxp/services/facturasEntrantesDedupe.ts`: marcar el error como esperado (bandera tipo `expected: true`) y ajustar `src/lib/ui/appFeedback.sentry.ts` para filtrarlo.
- Cierre de issues en Sentry con `update_issue` en el mismo turno del fix, referenciando los IDs en `CHANGELOG.md`.
- `APP_VERSION` → `13.511.0` + entrada en `CHANGELOG.md`.
